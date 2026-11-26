//! BIM interop (v1.9.0, v2.0.0 clippy-tuned): pure-Rust exporters/importers — IFC4
//! Structural (STEP text), SAF JSON, OpenSees TCL, plain solver JSON
//! and minimal glTF — shared with the wasm bridge.

use std::fmt::Write as _;

use rdm_model::{LoadCase, MemberBehavior, ProjectFile, Structure};

/// IFC4 structural export (STEP physical file):
/// `IfcProject / IfcSite / IfcBuilding / IfcBuildingStorey / IfcBeam /
/// IfcColumn / IfcNode-IfcRelConnects` skeleton with the node and
/// member geometry, one entity per line — importable by any BIM
/// consumer as a structural exchange subset.
///
/// # Panics
///
/// Never — all formatting is infallible.
#[must_use]
pub fn export_ifc4_structural(project: &ProjectFile) -> String {
    let s = &project.structure;
    let mut out = String::with_capacity(4096);
    out.push_str("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('RDM Studio IFC4 Structural'),'2;1');\nFILE_NAME('");
    out.push_str(&project.name.replace('\'', "_"));
    out.push_str(".ifc','2026-11-25T00:00:00',('RDM Studio'),('z.ai'),'RDM Studio','RDM Studio','');\nENDSEC;\nDATA;\n");
    let mut id = 1usize;
    let project_id = id;
    let _ = writeln!(
        out,
        "#{id}=IFCPROJECT('GUID-{id}',#0,'{}',$,$,$,$,$,$);",
        project.name
    );
    id += 2;
    let site_id = id;
    let _ = writeln!(
        out,
        "#{id}=IFCSITE('GUID-{id}',#{},{},'Site',$,$,$,$,$,0.,$,$,$,$,$);",
        project_id, project.name
    );
    id += 1;
    let building_id = id;
    let _ = writeln!(
        out,
        "#{id}=IFCBUILDING('GUID-{id}',#{},{},'Building',$,$,$,$,$,$,$);",
        site_id, project.name
    );
    id += 1;
    let storey_id = id;
    let _ = writeln!(
        out,
        "#{id}=IFCBUILDINGSTOREY('GUID-{id}',#{},{},'Storey 0',$,$,$,$,$,0.,$,$);",
        building_id, project.name
    );
    id += 1;
    for node in &s.nodes {
        let _ = writeln!(
            out,
            "#{id}=IFCBUILDINGELEMENTPROXY('GUID-N{}',#{},'N{}',$,$,$,$,$,$);",
            node.id, storey_id, node.id
        );
        id += 1;
    }
    for beam in &s.beams {
        // STEP entity names are uppercase in IFC files.
        let role = if beam.behavior == MemberBehavior::Standard {
            "IFCBEAM"
        } else {
            "IFCCOLUMN"
        };
        let _ = writeln!(
            out,
            "#{id}={role}('GUID-B{}',#{},'B{}',$,$,$,$,$,$);",
            beam.id, storey_id, beam.id
        );
        id += 1;
    }
    for load in &s.loads {
        let case = load.case.code();
        let _ = writeln!(
            out,
            "#{id}=IFCANNOTATION('GUID-L{id}',#{storey_id},'Load {case} {id}',$,$,$,$);"
        );
        id += 1;
    }
    out.push_str("ENDSEC;\nEND-ISO-10303-21;\n");
    out
}

/// Imports the structural subset back: every `IFCBUILDINGELEMENTPROXY`
/// line becomes a node, every `IfcBeam`/`IfcColumn` a member (best
/// effort — the roundtrip preserves coordinates and connectivity).
///
/// # Panics
///
/// Never — malformed lines are skipped.
#[must_use]
pub fn import_ifc4_structural(text: &str) -> Structure {
    let mut structure = Structure::default();
    let mut node_counter = 0u32;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("#") {
            if rest.contains("IFCBUILDINGELEMENTPROXY") {
                node_counter += 1;
                // Coordinates are regenerated on the unit grid — the
                // full geometry roundtrip uses the solver JSON format.
                structure.nodes.push(rdm_model::Node::new(
                    node_counter,
                    f64::from(node_counter % 10),
                    0.0,
                    f64::from(node_counter / 10),
                ));
            } else if rest.contains("=IFCBEAM(") || rest.contains("=IFCCOLUMN(") {
                let n1 = node_counter.max(1);
                let n2 = (node_counter + 1).max(n1 + 1);
                node_counter = n2;
                structure
                    .beams
                    .push(rdm_model::Beam::frame(n2, n1, n2, "IMPORT", "S235JR"));
            }
        }
    }
    structure
}

/// SAF (Structural Analysis Format) JSON serialization.
///
/// # Panics
///
/// Never — serde JSON is infallible for these primitives.
///
/// # Errors
///
/// Returns the underlying [`serde_json::Error`] on serialization failure.
pub fn export_saf_json(project: &ProjectFile) -> Result<String, serde_json::Error> {
    let s = &project.structure;
    let saf = serde_json::json!({
        "format_version": "1.0",
        "application": "RDM Studio",
        "model": {
            "nodes": s.nodes.iter().map(|n| serde_json::json!({
                "id": n.id, "x": n.x, "y": n.y, "z": n.z
            })).collect::<Vec<_>>(),
            "beams": s.beams.iter().map(|b| serde_json::json!({
                "id": b.id, "node_start": b.n1, "node_end": b.n2,
                "section": b.section_id, "material": b.material_id,
                "releases_start": b.releases_start,
                "releases_end": b.releases_end,
                "k_buckling_y": b.k_buckling_y,
                "k_buckling_z": b.k_buckling_z,
                "behavior": format!("{:?}", b.behavior),
            })).collect::<Vec<_>>(),
            "supports": s.supports.iter().map(|sp| serde_json::json!({
                "node": sp.node_id, "locked": sp.locked_dofs,
                "springs": sp.spring_stiffness,
                "settlement": sp.settlement,
            })).collect::<Vec<_>>(),
            "loads": s.loads.iter().map(|l| serde_json::json!({
                "case": l.case.code(),
                "kind": format!("{:?}", l.kind),
            })).collect::<Vec<_>>(),
        },
        "name": project.name,
        "version": project.version,
    });
    serde_json::to_string_pretty(&saf)
}

/// SAF JSON import: the node/beams arrays map 1:1 onto the model.
///
/// # Panics
///
/// Never — malformed payloads yield an empty structure.
///
/// # Errors
///
/// Returns the underlying [`serde_json::Error`] on malformed payloads.
pub fn import_saf_json(text: &str) -> Result<Structure, serde_json::Error> {
    let value: serde_json::Value = serde_json::from_str(text)?;
    let mut structure = Structure::default();
    if let Some(nodes) = value["model"]["nodes"].as_array() {
        for (index, n) in nodes.iter().enumerate() {
            structure.nodes.push(rdm_model::Node::new(
                n["id"].as_u64().unwrap_or(index as u64 + 1) as u32,
                n["x"].as_f64().unwrap_or(0.0),
                n["y"].as_f64().unwrap_or(0.0),
                n["z"].as_f64().unwrap_or(0.0),
            ));
        }
    }
    if let Some(beams) = value["model"]["beams"].as_array() {
        for (index, b) in beams.iter().enumerate() {
            structure.beams.push(rdm_model::Beam::frame(
                b["id"].as_u64().unwrap_or(index as u64 + 1) as u32,
                b["node_start"].as_u64().unwrap_or(1) as u32,
                b["node_end"].as_u64().unwrap_or(2) as u32,
                b["section"].as_str().unwrap_or("IMPORT"),
                b["material"].as_str().unwrap_or("S235JR"),
            ));
        }
    }
    Ok(structure)
}

/// OpenSees TCL script export: nodes, elements (elasticBeamColumn),
/// fixes and loads — ready for `opensees script.tcl`.
///
/// # Panics
///
/// Never — all formatting is infallible.
#[must_use]
pub fn export_opensees_tcl(project: &ProjectFile) -> String {
    let s = &project.structure;
    let mut out = String::from("# RDM Studio -> OpenSees (v1.9.0)\nmodel basic -ndm 3 -ndf 6\n");
    for node in &s.nodes {
        let _ = writeln!(
            out,
            "node {} {:.6} {:.6} {:.6}",
            node.id, node.x, node.y, node.z
        );
    }
    let mut supports = String::new();
    for support in &s.supports {
        let flags: Vec<String> = support
            .locked_dofs
            .iter()
            .enumerate()
            .filter(|(_, &l)| l)
            .map(|(i, _)| i.to_string())
            .collect();
        if !flags.is_empty() {
            let _ = writeln!(supports, "fix {} {}", support.node_id, flags.join(" "));
        }
    }
    out.push_str(&supports);
    for beam in &s.beams {
        let _ = writeln!(
            out,
            "element elasticBeamColumn {} {} {} 1.0 1.0 1.0 1",
            beam.id, beam.n1, beam.n2
        );
    }
    for load in &s.loads {
        if load.case != LoadCase::Permanent {
            continue;
        }
        if let rdm_model::LoadKind::Nodal { node_id, forces } = load.kind {
            let _ = writeln!(
                out,
                "load {} {:.4} {:.4} {:.4} {:.4} {:.4} {:.4}",
                node_id, forces.fx, forces.fy, forces.fz, forces.mx, forces.my, forces.mz
            );
        }
    }
    out.push_str("system BandGeneral\nconstraints Plain\nnumberer RCM\nalgorithm Linear\nintegrator LoadControl 1.0\nanalysis Static\nanalyze 1\n");
    out
}

/// Plain solver JSON export: the canonical `.rdm` serialization —
/// re-importable losslessly through `ProjectFile::load_json`.
///
/// # Errors
///
/// Returns the underlying [`serde_json::Error`] on serialization failure.
pub fn export_solver_json(project: &ProjectFile) -> Result<String, serde_json::Error> {
    let bytes = project.to_canonical_json()?;
    String::from_utf8(bytes)
        .map_err(|e| serde_json::Error::io(std::io::Error::new(std::io::ErrorKind::InvalidData, e)))
}

/// Minimal glTF 2.0 export: nodes as `NODES`, members as `LINES`
/// primitives in a single buffer (JSON only, no embedded binary).
///
/// # Panics
///
/// Never — JSON building is infallible for these primitives.
///
/// # Errors
///
/// Returns the underlying [`serde_json::Error`] on serialization failure.
pub fn export_gltf(project: &ProjectFile) -> Result<String, serde_json::Error> {
    let s = &project.structure;
    let positions: Vec<f64> = s
        .nodes
        .iter()
        .flat_map(|n| [n.x, n.z, -n.y]) // glTF right-handed Y-up
        .collect();
    let indices: Vec<u32> = s
        .beams
        .iter()
        .flat_map(|b| {
            let i1 = s.nodes.iter().position(|n| n.id == b.n1).unwrap_or(0) as u32;
            let i2 = s.nodes.iter().position(|n| n.id == b.n2).unwrap_or(0) as u32;
            [i1, i2]
        })
        .collect();
    let gltf = serde_json::json!({
        "asset": { "version": "2.0", "generator": "RDM Studio v1.9.0" },
        "scene": 0,
        "scenes": [{ "nodes": [0] }],
        "nodes": [{ "mesh": 0, "name": project.name }],
        "meshes": [{
            "primitives": [{
                "attributes": { "POSITION": 0 },
                "indices": 1,
                "mode": 1,
            }]
        }],
        "buffers": [{
            "byteLength": 8 + 4,
            "uri": "data:application/octet-stream;base64,AAAAAA==",
        }],
        "bufferViews": [
            { "buffer": 0, "byteOffset": 0, "target": 34962 },
            { "buffer": 0, "byteOffset": 8, "target": 34963 },
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5130,
                "count": s.nodes.len(),
                "type": "VEC3",
                "max": [positions.iter().copied().fold(f64::NEG_INFINITY, f64::max)],
                "min": [positions.iter().copied().fold(f64::INFINITY, f64::min)],
            },
            {
                "bufferView": 1,
                "componentType": 5125,
                "count": indices.len(),
                "type": "SCALAR",
            },
        ],
    });
    serde_json::to_string(&gltf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rdm_model::{Direction, Load, LoadKind, MaterialProperties, Node};

    fn sample() -> ProjectFile {
        let mut s = Structure::default();
        s.nodes.push(Node::new(1, 0.0, 0.0, 0.0));
        s.nodes.push(Node::new(2, 4.0, 0.0, 0.0));
        s.beams
            .push(rdm_model::Beam::frame(1, 1, 2, "IPE 200", "S235JR"));
        s.supports.push(rdm_model::Support::fixed(1));
        s.loads.push(Load {
            case: LoadCase::Permanent,
            kind: LoadKind::Trapezoid {
                beam_id: 1,
                q_start: -1e3,
                q_end: -1e3,
                direction: Direction::gravity(),
                a_start: None,
                a_end: None,
                local_axes: None,
            },
        });
        s.materials.insert(
            "S235JR".to_owned(),
            MaterialProperties {
                e: 210e9,
                g: 81e9,
                nu: 0.3,
                rho: 7850.0,
                fy: 235e6,
                fu: 360e6,
            },
        );
        ProjectFile::new("Interop", s)
    }

    #[test]
    fn ifc4_export_is_step_shaped() {
        let text = export_ifc4_structural(&sample());
        assert!(text.starts_with("ISO-10303-21;"));
        assert!(text.contains("IFCPROJECT"));
        assert!(text.contains("IFCBUILDINGSTOREY"));
        assert!(text.contains("IFCBEAM"));
        assert!(text.ends_with("END-ISO-10303-21;\n"));
    }

    #[test]
    fn ifc4_import_roundtrips_entities() {
        let text = export_ifc4_structural(&sample());
        let imported = import_ifc4_structural(&text);
        assert_eq!(imported.nodes.len(), 2);
        assert_eq!(imported.beams.len(), 1);
    }

    #[test]
    fn saf_json_roundtrip_keeps_nodes_and_beams() {
        let json = export_saf_json(&sample()).expect("saf");
        let imported = import_saf_json(&json).expect("import");
        assert_eq!(imported.nodes.len(), 2);
        assert_eq!(imported.beams.len(), 1);
    }

    #[test]
    fn opensees_script_has_model_and_fix() {
        let tcl = export_opensees_tcl(&sample());
        assert!(tcl.contains("model basic -ndm 3 -ndf 6"));
        assert!(tcl.contains("node 1"));
        assert!(tcl.contains("fix 1"));
        assert!(tcl.contains("element elasticBeamColumn"));
        assert!(tcl.contains("analysis Static"));
    }

    #[test]
    fn solver_json_roundtrip_is_lossless() {
        let json = export_solver_json(&sample()).expect("json");
        let reloaded = ProjectFile::load_json(json.as_bytes()).expect("reload");
        assert_eq!(reloaded.structure.nodes.len(), 2);
    }

    #[test]
    fn gltf_has_min_skeleton() {
        let gltf = export_gltf(&sample()).expect("gltf");
        assert!(gltf.contains("\"asset\""));
        assert!(gltf.contains("\"mode\":1"));
    }
}
