export const getComputeShader = (hasRadius: boolean) => `
struct Uniforms {
    targetPos: vec2<f32>,
    defaultPointRadius: f32,
    resolution: f32,
    total: u32,
}

struct Result {
    count: atomic<u32>,
    indices: array<u32, 1024>,
}

@group(0) @binding(0) var<storage, read> positions: array<f32>;
@group(0) @binding(1) var<uniform> params: Uniforms;
@group(0) @binding(2) var<storage, read_write> result: Result;
${hasRadius ? '@group(0) @binding(3) var<storage, read> radii: array<u32>;' : ''}

@compute @workgroup_size(64)
fn main(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let index = global_id.x;
    var isSelected = false;

    // Check selection condition
    if (index < params.total) {
        let px = positions[index * 2];
        let py = positions[index * 2 + 1];
        let dx = px - params.targetPos.x;
        let dy = py - params.targetPos.y;
        let distSq = dx * dx + dy * dy;

        var pointRadius = params.defaultPointRadius;
        ${
			hasRadius
				? `
        let rIndex = index / 4u;
        let rShift = (index % 4u) * 8u;
        pointRadius = f32((radii[rIndex] >> rShift) & 255u);
        `
				: ''
		}

        // Point pick
        // Condition: dist < 3 || dist < pointRadius
        // Convert pixel threshold to world threshold: pixel * resolution
        let toleranceWorld = 3.0 * params.resolution;
        let radiusWorld = pointRadius * params.resolution;
        
        if (distSq < toleranceWorld * toleranceWorld || distSq < radiusWorld * radiusWorld) {
            isSelected = true;
        }
    }

    // Direct Global Atomic
    // Suitable for small radius pick (few selected points), avoids barrier overhead.
    if (isSelected) {
        let idx = atomicAdd(&result.count, 1u);
        if (idx < 1024u) {
            result.indices[idx] = index;
        }
    }
}
`
