//! Non-regression snapshots of the EN 1993-1-1 member-check reports
//! (ARCHITECTURE.md §5, `report_snapshots.rs`, §14 level 2).

use serde_json::Value;

use rdm_eurocode::{MemberCheckInput, member_check, profile_catalog};
use rdm_model::MaterialProperties;

/// Rounds every float in a JSON tree so snapshots stay platform-stable.
fn round_floats(value: &mut Value) {
    match value {
        Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                *value = serde_json::json!((f * 1e6).round() / 1e6);
            }
        }
        Value::Array(items) => items.iter_mut().for_each(round_floats),
        Value::Object(map) => map.values_mut().for_each(round_floats),
        _ => {}
    }
}

fn s235() -> MaterialProperties {
    MaterialProperties {
        e: 210e9,
        g: 81e9,
        nu: 0.3,
        rho: 7850.0,
        fy: 235e6,
        fu: 360e6,
    }
}

/// Full member-check report snapshot for an IPE 200 in bending + shear.
#[test]
fn ipe200_bending_report_snapshot() {
    let props = profile_catalog().properties("IPE 200").unwrap();
    let mat = s235();
    let check = member_check(MemberCheckInput {
        beam_id: 12,
        length: 6.0,
        k_buckling: (1.0, 1.0),
        section: &props,
        material: &mat,
        forces: (150_000.0, 45_000.0, 0.0, 20_000.0, 0.0),
        combination: "ULS 1.35G + 1.50Q".to_owned(),
    })
    .unwrap();
    // Round floats so the snapshot is stable across platforms.
    let mut rounded = serde_json::to_value(&check).unwrap();
    round_floats(&mut rounded);
    insta::assert_json_snapshot!("ipe200_bending", rounded);
}

/// Compression-column snapshot: HEA 200 with buckling factors.
#[test]
fn hea200_column_report_snapshot() {
    let props = profile_catalog().properties("HEA 200").unwrap();
    let mat = s235();
    let check = member_check(MemberCheckInput {
        beam_id: 7,
        length: 3.5,
        k_buckling: (1.0, 1.0),
        section: &props,
        material: &mat,
        forces: (-500_000.0, 0.0, 0.0, 0.0, 0.0),
        combination: "ULS 1.35G".to_owned(),
    })
    .unwrap();
    let mut rounded = serde_json::to_value(&check).unwrap();
    round_floats(&mut rounded);
    insta::assert_json_snapshot!("hea200_column", rounded);
}
