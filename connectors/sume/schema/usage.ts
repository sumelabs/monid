import {
    type Json,
    Unit,
    type UsageEvidenceFn,
    UsageModelKind,
} from "@shared/core";

export const remixUsageModel = {
    kind: UsageModelKind.COMPOSITE,
    components: {
        "480p": {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.SECOND,
            label: "480p source seconds",
            description: "$0.123 per second of source video at 480p",
            consumes: { credit: "default", amount: 0.123 },
        },
        "720p": {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.SECOND,
            label: "720p source seconds",
            description: "$0.2766 per second of source video at 720p",
            consumes: { credit: "default", amount: 0.2766 },
        },
        "1080p": {
            kind: UsageModelKind.PER_UNIT,
            unit: Unit.SECOND,
            label: "1080p source seconds",
            description: "$0.6804 per second of source video at 1080p",
            consumes: { credit: "default", amount: 0.6804 },
        },
    },
} as const;

export type RemixUsageModel = typeof remixUsageModel;

type RemixResolution = "480p" | "720p" | "1080p";

type RemixBody = { resolution: RemixResolution; duration?: number };

type RemixCounts = { counts: Partial<Record<RemixResolution, number>> };

export const remixEstimate = (
    { data }: { data: { input: { body: RemixBody } } },
): RemixCounts => ({
    counts: {
        [data.input.body.resolution]: data.input.body.duration ?? 15,
    },
});

export const remixEvidence = (
    { data, utils }: {
        data: { input: { body: RemixBody }; output: Json };
        utils: Parameters<UsageEvidenceFn>[0]["utils"];
    },
): RemixCounts => {
    const line = data.input.body.resolution;
    const stated = utils.json.optionalGet(
        data.output,
        "$.data.job.input.duration",
    );
    if (typeof stated === "number" && stated > 0) {
        return { counts: { [line]: stated } };
    }
    if (data.input.body.duration !== undefined) {
        return { counts: { [line]: data.input.body.duration } };
    }
    const artifacts = utils.json.optionalGet(
        data.output,
        "$.data.job.result.artifacts",
    );
    let milliseconds = 0;
    if (Array.isArray(artifacts)) {
        for (const item of artifacts) {
            if (
                item !== null && typeof item === "object" &&
                !Array.isArray(item) && item.type === "video" &&
                typeof item.duration_ms === "number"
            ) {
                milliseconds = Math.max(milliseconds, item.duration_ms);
            }
        }
    }
    return milliseconds > 0
        ? { counts: { [line]: milliseconds / 1000 } }
        : { counts: {} };
};
