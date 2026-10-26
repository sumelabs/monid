import {
    assert,
    assertAlmostEquals,
    assertEquals,
    assertRejects,
} from "@std/assert";
import { fromFileUrl } from "@std/path";
import type { Json, RunInput } from "@shared/core";
import {
    estimateEndpoint,
    liveSkip,
    loadFixture,
    replayFetch,
    runEndpoint,
    testBundle,
    testSealedUnit,
} from "@shared/testing";
import { directTransport, Engine } from "@monid/connector-engine";

const HERE = fromFileUrl(new URL("./", import.meta.url));
const INPUTS = JSON.parse(
    await Deno.readTextFile(`${HERE}test-inputs.json`),
) as Record<string, Record<string, Json>>;

const MOTION = "sume#v1/video/sume-remix-motion-transfer";
const SWAP = "sume#v1/video/sume-remix-object-swap";
const RESTYLE = "sume#v1/video/sume-remix-restyle";
const IDS = [MOTION, SWAP, RESTYLE];

const fixture = (name: string) => loadFixture(`${HERE}fixtures/${name}.json`);

const inputFor = (id: string, overrides: Record<string, Json> = {}) => {
    const body = INPUTS[id.split("#")[1]];
    assert(body !== undefined, `${id}: no test input in test-inputs.json`);
    return { body: { ...body, ...overrides } } as RunInput;
};

const run = async (id: string, chain: string, input = inputFor(id)) =>
    await runEndpoint({
        unit: await testSealedUnit(id),
        input,
        mode: "replay",
        fixture: await fixture(chain),
    });

function assertBilled(
    usage: {
        credits: Record<string, number>;
        evidence: Record<string, number>;
        mismatch?: { derived: Record<string, number> };
    },
    expected: {
        claim: number;
        evidence: Record<string, number>;
        derived: number;
    },
    label?: string,
) {
    assertEquals(Object.keys(usage.credits), ["default"], label);
    assertAlmostEquals(usage.credits.default, expected.claim, 1e-9, label);
    assertEquals(usage.evidence, expected.evidence, label);
    assert(usage.mismatch !== undefined, `${label}: fold cross-check`);
    assertAlmostEquals(
        usage.mismatch.derived.default,
        expected.derived,
        1e-9,
        label,
    );
}

const ZERO = { credits: {}, evidence: {} };

Deno.test("sume: the connector publishes exactly the three Remix endpoints", async () => {
    const bundle = await testBundle();
    const ids = Object.keys(bundle.endpoints)
        .filter((id) => id.startsWith("sume#"))
        .sort();
    assertEquals(ids, [...IDS].sort());
    assertEquals(
        bundle.endpoints[MOTION].request.url,
        "https://api.sume.com/v1/sume/remix/motion-transfer/v1.0",
    );
    assertEquals(
        bundle.endpoints[SWAP].request.url,
        "https://api.sume.com/v1/sume/remix/object-swap/v1.0",
    );
    assertEquals(
        bundle.endpoints[RESTYLE].request.url,
        "https://api.sume.com/v1/sume/remix/restyle/v1.0",
    );
    for (const id of IDS) {
        assertEquals(bundle.endpoints[id].request.method, "POST", id);
    }
});

Deno.test("sume: every endpoint completes the job and bills the captured charge", async () => {
    for (const id of IDS) {
        const result = await run(id, "synthetic-job-completed");
        assertEquals(result.httpStatus, 200, id);
        assertEquals(result.isProviderError, false, id);
        assertBilled(result.usage, {
            claim: 1.4,
            evidence: { "720p": 5 },
            derived: 1.383,
        }, id);
        const job = ((result.output as Record<string, Json>).data as Record<
            string,
            Json
        >).job as Record<string, Json>;
        assertEquals(job.status, "completed", id);
        assert(!("usage_summary" in job), `${id}: usage_summary is consumed`);
        const artifacts = (job.result as Record<string, Json>)
            .artifacts as Record<string, Json>[];
        assertEquals(artifacts[0].type, "video", id);
        assert(typeof artifacts[0].url === "string", id);
        assertEquals(result.timing.attempts, 2, id);
    }
});

Deno.test("sume: a completed job keeps polling until its charge is final", async () => {
    const result = await run(SWAP, "synthetic-job-settling");
    assertEquals(result.httpStatus, 200);
    assertEquals(result.timing.attempts, 2);
    assertBilled(result.usage, {
        claim: 1.4,
        evidence: { "720p": 5 },
        derived: 1.383,
    });
});

Deno.test("sume: without a duration the evidence reads the output length and the fold rounds it up", async () => {
    const body = { ...inputFor(MOTION).body as Record<string, Json> };
    delete body.duration;
    const result = await run(MOTION, "synthetic-job-no-duration", { body });
    assertEquals(result.httpStatus, 200);
    assertBilled(result.usage, {
        claim: 3.33,
        evidence: { "720p": 11.7 },
        derived: 3.3192,
    });
});

Deno.test("sume: a refused job bills $0 and surfaces Sume's reason", async () => {
    const result = await run(RESTYLE, "synthetic-job-failed");
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 500);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.usage, ZERO);
    const output = result.output as Record<string, Json>;
    assertEquals(output.code, "generation_rejected");
    assert(
        typeof output.message === "string" &&
            output.message.startsWith("Sume Remix could not make this edit"),
    );
    assert(output.raw !== undefined, "the raw job stays under raw");
});

Deno.test("sume: a canceled job bills $0", async () => {
    const result = await run(MOTION, "synthetic-job-canceled");
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 409);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.usage, ZERO);
});

Deno.test("sume: a completed job without a video bills $0", async () => {
    const result = await run(SWAP, "synthetic-job-no-video");
    assertEquals(result.isProviderError, true);
    assertEquals(result.httpStatus, 502);
    assertEquals(result.providerHttpStatus, 200);
    assertEquals(result.usage, ZERO);
});

Deno.test("sume: a refused submit is data, never polled and billed $0", async () => {
    const rows: [string, number, string][] = [
        ["synthetic-submit-insufficient-funds", 402, "insufficient_funds"],
        ["synthetic-submit-invalid", 400, "invalid_request"],
    ];
    for (const [chain, status, code] of rows) {
        for (const id of IDS) {
            const result = await run(id, chain);
            assertEquals(result.isProviderError, true, `${id} ${chain}`);
            assertEquals(result.httpStatus, status, `${id} ${chain}`);
            assertEquals(result.usage, ZERO, `${id} ${chain}`);
            assertEquals(
                (result.output as Record<string, Json>).code,
                code,
                `${id} ${chain}`,
            );
        }
    }
});

Deno.test("sume: a 2xx submit without a job id throws instead of polling", async () => {
    await assertRejects(
        () => run(MOTION, "synthetic-submit-no-job"),
        Error,
        "no job id",
    );
});

Deno.test("sume: a failing job query throws rather than abandoning a running job", async () => {
    await assertRejects(
        () => run(RESTYLE, "synthetic-poll-failed"),
        Error,
        "503",
    );
});

Deno.test("sume: every submit carries the bearer key and an idempotency key from the run id", async () => {
    const unit = await testSealedUnit(MOTION);
    const chain = await fixture("synthetic-job-completed");
    const requestUrl = unit.doc.request.url;
    const replay = replayFetch(chain, {
        "request.url": requestUrl,
        "request.origin": new URL(requestUrl).origin,
    });
    const sent: Record<string, string>[] = [];
    const engine = new Engine({
        transport: directTransport({
            params: () => Promise.resolve({ apiKey: "test-key" }),
            fetch: (input, init) => {
                sent.push({ ...(init?.headers as Record<string, string>) });
                return replay(input, init);
            },
        }),
        sleep: () => Promise.resolve(),
    });
    const loaded = await engine.load(unit);
    const started = await loaded.start(inputFor(MOTION), { runId: "run-1" });
    assertEquals(started.kind, "RUNNING");
    assertEquals(sent[0]["Idempotency-Key"], "run-1:submit");
    assertEquals(sent[0]["Authorization"], "Bearer test-key");
    assertEquals(sent[0]["Accept"], "application/json");
});

Deno.test("sume: estimates hold the stated seconds, or 15 s, on the requested line", async () => {
    const rows: [
        string,
        Record<string, Json>,
        number,
        Record<string, number>,
    ][] = [
        [MOTION, {}, 1.383, { "720p": 5 }],
        [MOTION, { resolution: "480p", duration: 4 }, 0.492, { "480p": 4 }],
        [SWAP, { resolution: "1080p", duration: 15 }, 10.206, {
            "1080p": 15,
        }],
        [RESTYLE, { resolution: "480p" }, 0.615, { "480p": 5 }],
    ];
    for (const [id, overrides, dollars, evidence] of rows) {
        const usage = await estimateEndpoint(
            await testSealedUnit(id),
            inputFor(id, overrides),
        );
        assertAlmostEquals(usage.credits.default, dollars, 1e-9, id);
        assertEquals(usage.evidence, evidence, id);
    }
    for (const id of IDS) {
        const body = { ...inputFor(id).body as Record<string, Json> };
        delete body.duration;
        delete body.resolution;
        const usage = await estimateEndpoint(await testSealedUnit(id), {
            body,
        });
        assertEquals(usage.evidence, { "720p": 15 }, id);
        assertAlmostEquals(usage.credits.default, 4.149, 1e-9, id);
    }
});

Deno.test("sume: the input schemas refuse bad requests before the wire", async () => {
    const rejects = async (id: string, overrides: Record<string, Json>) => {
        await assertRejects(
            async () =>
                await estimateEndpoint(
                    await testSealedUnit(id),
                    inputFor(id, overrides),
                ),
            Error,
            "INVALID_INPUT",
            `${id} ${JSON.stringify(overrides)}`,
        );
    };
    const image = "https://example.test/person.png";
    for (const id of [MOTION, SWAP]) {
        await rejects(id, { image_urls: [] });
        await rejects(id, { image_urls: Array(9).fill(image) });
        await rejects(id, { image_urls: ["http://example.test/person.png"] });
        await rejects(id, { preset_id: "rounded-toy-cgi" });
    }
    for (const id of IDS) {
        await rejects(id, { video_url: "http://example.test/source.mp4" });
        await rejects(id, { duration: 3 });
        await rejects(id, { duration: 16 });
        await rejects(id, { duration: 4.5 });
        await rejects(id, { resolution: "4k" });
        await rejects(id, { model: "anything" });
        await rejects(id, { prompt: "x".repeat(10_001) });
    }
    await rejects(RESTYLE, { image_urls: [image] });
    await rejects(RESTYLE, { preset_id: "watercolor" });
    const edge = await estimateEndpoint(
        await testSealedUnit(SWAP),
        inputFor(SWAP, { image_urls: Array(8).fill(image), duration: 15 }),
    );
    assertEquals(edge.evidence, { "720p": 15 });
});

Deno.test("sume: the three endpoints share one lifecycle, one settle and one rate card", async () => {
    const bundle = await testBundle();
    const first = bundle.endpoints[IDS[0]];
    const start = first.lifecycle?.start?.$fn.key;
    const poll = first.lifecycle?.poll?.$fn.key;
    const consolidate = first.usage.consolidate?.$fn.key;
    const estimate = first.usage.estimate?.$fn.key;
    const evidence = first.usage.evidence?.$fn.key;
    assert(start && poll && consolidate && estimate && evidence);
    assertEquals(
        bundle.fnTable[consolidate].provenance,
        "connectors/sume/provider.ts#usage.consolidate",
    );
    for (const id of IDS) {
        const doc = bundle.endpoints[id];
        assertEquals(doc.lifecycle?.start?.$fn.key, start, id);
        assertEquals(doc.lifecycle?.poll?.$fn.key, poll, id);
        assertEquals(doc.lifecycle?.stop, undefined, id);
        assertEquals(doc.usage.consolidate?.$fn.key, consolidate, id);
        assertEquals(doc.usage.estimate?.$fn.key, estimate, id);
        assertEquals(doc.usage.evidence?.$fn.key, evidence, id);
        assertEquals(doc.usage.credits, {
            default: { label: "US dollars" },
        }, id);
        assertEquals(doc.usage.model, first.usage.model, id);
        assertEquals(doc.timeouts.pollMs, 10_000, id);
    }
});

Deno.test({
    name:
        "sume#v1/video/sume-remix-restyle live: restyles a real clip and bills it",
    ignore: liveSkip("sume") || !Deno.env.get("SUME_LIVE_SOURCE_URL"),
    fn: async () => {
        const result = await runEndpoint({
            unit: await testSealedUnit(RESTYLE),
            input: {
                body: {
                    video_url: Deno.env.get("SUME_LIVE_SOURCE_URL") ?? "",
                    preset_id: "rounded-toy-cgi",
                    resolution: "480p",
                },
            },
            mode: "live",
        });
        assertEquals(result.httpStatus, 200);
        assert(result.usage.credits.default > 0);
        assertEquals(Object.keys(result.usage.evidence), ["480p"]);
    },
});
