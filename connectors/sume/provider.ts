import { defineProvider, presets } from "@shared/core";
import { remixUsageModel } from "./schema/usage.ts";

export default defineProvider({
    name: "sume",
    meta: {
        displayName: "Sume",
        summary:
            "Sume Remix: recast, swap or restyle an existing video while its motion, camera, length and sound stay.",
        description: "Sume Remix edits a video you already have. Motion " +
            "Transfer puts the people from your photos into the source's " +
            "movement and camera; Object Swap replaces a person or object " +
            "and leaves the rest of the shot as it was; Restyle redraws the " +
            "whole clip in one of 20 Sume styles. Sume plans the edit from " +
            "the source and the photos, so you send media and an optional " +
            "note, not an engineered prompt. The result keeps the source's " +
            "length and its original sound track, at 480p, 720p or 1080p. " +
            "Priced per second of source video.",
        homepageUrl: "https://www.sume.com",
        docsUrl: "https://www.sume.com/docs/jobs",
        categories: ["video-generation"],
        notes: [
            "Edits are asynchronous and take several minutes; poll the run " +
            "rather than blocking on it.",
            "The source video must be a public https:// MP4 or MOV, 4 to " +
            "15 seconds long; a longer source is refused, not trimmed.",
            "A source smaller than 640 px on its shortest side, or media a " +
            "content check refuses, fails the job; a refused, failed or " +
            "canceled job bills $0.",
            "The finished clip is a Sume-hosted MP4 in " +
            "data.job.result.artifacts.",
            "The bill is the job's captured charge, which Sume rounds up to " +
            "whole cents; leave duration out and Sume reads the source " +
            "length from the file.",
        ],
    },
    auth: { inject: presets.auth.bearer() },
    request: {
        baseUrl: "https://api.sume.com",
        headers: { Accept: "application/json" },
    },
    timeouts: { requestMs: 60_000, runMs: 1_800_000, pollMs: 10_000 },
    lifecycle: {
        start: async ({ data, utils, logger }) => {
            const res = await utils.request({
                headers: {
                    ...data.request.headers,
                    "Idempotency-Key": data.run.runId + ":submit",
                },
            });
            if (res.status < 200 || res.status >= 300) {
                return {
                    kind: "COMPLETED",
                    httpStatus: res.status,
                    output: res.body,
                };
            }
            const jobId = utils.json.optionalGet(res.body, "$.data.job.id");
            if (typeof jobId !== "string" || jobId === "") {
                throw Object.assign(
                    new Error("Sume submit returned no job id"),
                    { retriable: false },
                );
            }
            logger.debug("sume remix job submitted", { jobId });
            return { kind: "RUNNING", state: { externalRunId: jobId } };
        },
        poll: async ({ data, utils, logger }) => {
            const jobId = data.lifecycle.state.externalRunId;
            if (jobId === undefined) {
                throw Object.assign(
                    new Error("Sume poll without externalRunId in state"),
                    { retriable: false },
                );
            }
            const res = await utils.http({
                method: "GET",
                path: "/v1/jobs/" + encodeURIComponent(jobId),
            });
            if (res.status < 200 || res.status >= 300) {
                throw new Error(
                    "Sume job query returned " + String(res.status),
                );
            }
            const status = utils.json.optionalGet(
                res.body,
                "$.data.job.status",
            );
            if (status === "queued" || status === "processing") {
                return {
                    kind: "RUNNING",
                    state: { externalRunId: jobId, stage: status },
                };
            }
            if (status === "failed" || status === "canceled") {
                logger.warn("sume remix job did not complete", {
                    jobId,
                    status,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: status === "canceled" ? 409 : 500,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            if (status !== "completed") {
                logger.warn("sume remix job status unrecognized", {
                    jobId,
                    status: String(status),
                });
                return { kind: "RUNNING" };
            }
            const final = utils.json.optionalGet(
                res.body,
                "$.data.job.usage_summary.final",
            );
            if (final === false) {
                return {
                    kind: "RUNNING",
                    state: { externalRunId: jobId, stage: "settling" },
                };
            }
            const artifacts = utils.json.optionalGet(
                res.body,
                "$.data.job.result.artifacts",
            );
            const hasVideo = Array.isArray(artifacts) && artifacts.some(
                (item) =>
                    item !== null && typeof item === "object" &&
                    !Array.isArray(item) && item.type === "video" &&
                    typeof item.url === "string" && item.url !== "",
            );
            if (!hasVideo) {
                logger.warn("sume remix job completed without a video", {
                    jobId,
                });
                return {
                    kind: "COMPLETED",
                    httpStatus: 502,
                    providerHttpStatus: res.status,
                    output: res.body,
                };
            }
            return {
                kind: "COMPLETED",
                httpStatus: 200,
                providerHttpStatus: res.status,
                output: res.body,
            };
        },
    },
    output: {
        fromError: ({ data, utils }) => {
            const jobMessage = utils.json.optionalGet(
                data.output,
                "$.data.job.error.message",
            );
            const submitMessage = utils.json.optionalGet(
                data.output,
                "$.error.message",
            );
            const code = utils.json.optionalGet(
                data.output,
                "$.data.job.error.code",
            ) ?? utils.json.optionalGet(data.output, "$.error.code");
            const message = typeof jobMessage === "string"
                ? jobMessage
                : typeof submitMessage === "string"
                ? submitMessage
                : "Sume Remix could not make this edit";
            return {
                message,
                ...(typeof code === "string" ? { code } : {}),
                raw: data.output,
            };
        },
    },
    usage: {
        credits: { default: { label: "US dollars" } },
        model: remixUsageModel,
        consolidate: ({ data, utils }) => {
            const plucked = utils.json.pluck(
                data.output,
                "$.data.job.usage_summary",
            );
            const summary = plucked.value ?? null;
            const status = utils.json.optionalGet(summary, "$.status");
            const cents = status === "captured"
                ? utils.json.optionalNum(summary, "$.captured_usd_cents")
                : undefined;
            return {
                credits: {
                    ...(cents !== undefined ? { default: cents / 100 } : {}),
                },
                output: plucked.rest,
            };
        },
    },
});
