//! v1.7.0 fuzz/property tests: the `.rdm` parser never panics on hostile
//! or mutated payloads (deterministic xorshift mutation loop — no new
//! dependencies).

use rdm_model::ProjectFile;

fn xorshift(state: &mut u64) -> u64 {
    *state ^= *state >> 12;
    *state ^= *state << 25;
    *state ^= *state >> 27;
    *state
}

#[test]
fn project_parser_never_panics_on_mutated_payloads() {
    let base = r#"{
        "version": 2,
        "name": "Fuzz",
        "structure": {
            "nodes": [{"id": 1, "x": 0.0, "y": 0.0, "z": 0.0}],
            "beams": [],
            "supports": [],
            "loads": [],
            "sections": {},
            "materials": {},
            "self_weight_enabled": true,
            "settings": {"shear_deformation": true, "plane_frame_2d": false},
            "load_cases": [],
            "groups": [],
            "levels": []
        }
    }"#;
    let mut state: u64 = 0x9E37_79B9_7F4A_7C15;
    for _round in 0..2000_u64 {
        let mut bytes = base.as_bytes().to_vec();
        let mutations = 1 + (xorshift(&mut state) % 8) as usize;
        for _ in 0..mutations {
            let pos = (xorshift(&mut state) as usize) % bytes.len();
            match xorshift(&mut state) % 4 {
                0 => bytes[pos] = (xorshift(&mut state) % 256) as u8,
                1 => {
                    bytes.remove(pos);
                }
                2 => bytes.insert(pos, b'"'),
                _ => bytes.truncate((pos).max(1)),
            }
            if bytes.is_empty() {
                break;
            }
        }
        // The parse must return (Ok or Err) — never panic.
        let _ = ProjectFile::from_json(&bytes);
        let _ = ProjectFile::load_json(&bytes);
    }
}

#[test]
fn project_parser_tolerates_extreme_numbers() {
    for payload in [
        r#"{"version":2,"name":"N","structure":{"nodes":[{"id":1,"x":1e309,"y":-1e309,"z":0.0}],"beams":[],"supports":[],"loads":[],"sections":{},"materials":{},"self_weight_enabled":true}}"#,
        r#"{"version":2,"name":"NaN","structure":{"nodes":[{"id":1,"x":0.0,"y":0.0,"z":0.0},{"id":1,"x":0.0,"y":0.0,"z":0.0}],"beams":[],"supports":[],"loads":[],"sections":{},"materials":{},"self_weight_enabled":true}}"#,
        r#"{"version":-5,"name":"","structure":{"nodes":[],"beams":[],"supports":[],"loads":[],"sections":{},"materials":{},"self_weight_enabled":false,"settings":{"national_annex":"XX","combination_method":"bogus"}}}"#,
        r#"{"version":"two","name":42,"structure":null}"#,
    ] {
        let _ = ProjectFile::from_json(payload.as_bytes());
        let _ = ProjectFile::load_json(payload.as_bytes());
    }
}
