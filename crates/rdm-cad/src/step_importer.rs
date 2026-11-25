//! STEP / IGES wireframe extraction (`step_importer.rs`, v1.3.0): pulls
//! ISO-10303-21 `CARTESIAN_POINT` + `LINE` / `VECTOR` / `TRIMMED_CURVE`
//! entities out of `.step` / `.stp` payloads and IGES type `110` Line
//! entities out of `.igs` / `.iges` payloads as metre-scale raw segments.
//!
//! Pure Rust: no external CAD dependency. Millimetre header units are
//! converted to metres when declared (`SI_UNIT(.MILLI.,.METRE.)` in STEP,
//! the `MM` unit parameter in the IGES global section).

use std::collections::HashMap;

use crate::{CadError, RawSegment};

/// Sniffs the payload flavour and dispatches to the right extractor.
///
/// # Errors
///
/// Returns [`CadError::Parse`] on malformed payloads and
/// [`CadError::Empty`] when nothing importable remains.
pub fn import_step_or_iges(bytes: &[u8]) -> Result<Vec<RawSegment>, CadError> {
    let head = String::from_utf8_lossy(&bytes[..bytes.len().min(2048)]).to_uppercase();
    // IGES sniff: fixed 80-column records put 'S'/'G'/'P' in column 73 of
    // the first records (content itself varies, so do not match on text).
    let first_line = head.lines().next().unwrap_or("");
    let is_iges = first_line.len() >= 73
        && (first_line.as_bytes()[72] == b'S' || first_line.as_bytes()[72] == b'G');
    let segments = if head.contains("ISO-10303-21") {
        import_step(bytes)?
    } else if head.contains("IGES") || is_iges {
        import_iges(bytes)?
    } else {
        return Err(CadError::Parse(
            "unrecognized STEP/IGES payload (no ISO-10303-21 or IGES signature)".to_owned(),
        ));
    };
    if segments.is_empty() {
        return Err(CadError::Empty);
    }
    Ok(segments)
}

/// Parses ASCII STEP (ISO-10303-21) data-section entities into segments.
fn import_step(bytes: &[u8]) -> Result<Vec<RawSegment>, CadError> {
    let text = String::from_utf8_lossy(bytes);
    // Entity table: id -> full definition ("TYPE(arg,arg,...)").
    let mut entities: HashMap<u32, String> = HashMap::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('#') {
            continue;
        }
        let Some((id_part, body)) = trimmed.split_once('=') else {
            continue;
        };
        let Ok(id) = id_part[1..].trim().parse::<u32>() else {
            continue;
        };
        entities.insert(id, body.trim().trim_end_matches(';').to_owned());
    }
    if entities.is_empty() {
        return Err(CadError::Empty);
    }
    // Millimetre declaration: SI_UNIT(.MILLI.,.METRE.) or a
    // CONVERSION_BASED_UNIT named MILLIMETRE.
    let milli = text.to_uppercase().contains("SI_UNIT(.MILLI.,.METRE.)")
        || text
            .to_uppercase()
            .contains("CONVERSION_BASED_UNIT('MILLIMETRE'");
    let scale = if milli { 1e-3 } else { 1.0 };

    // Numeric triple lookup: id -> [x, y, z] (CARTESIAN_POINT for points
    // and trim marks, DIRECTION for vector directions).
    let mut points: HashMap<u32, [f64; 3]> = HashMap::new();
    for (id, body) in &entities {
        if body.starts_with("CARTESIAN_POINT") || body.starts_with("DIRECTION") {
            if let Some(coords) = numeric_triple(body) {
                points.insert(*id, coords);
            }
        }
    }

    // VECTOR lookup: id -> (direction id, magnitude).
    let mut vectors: HashMap<u32, (u32, f64)> = HashMap::new();
    for (id, body) in &entities {
        if body.starts_with("VECTOR") {
            // VECTOR('',#dir,#magnitude): the magnitude is a plain
            // number, so exactly one #ref (the DIRECTION) precedes it.
            let refs = entity_refs(body);
            if refs.len() == 1 {
                if let Some(mag) = trailing_number(body) {
                    vectors.insert(*id, (refs[0], mag));
                }
            }
        }
    }

    let mut segments: Vec<RawSegment> = Vec::new();
    for body in entities.values() {
        if body.starts_with("LINE") {
            // LINE('',#start_point,#vector)
            let refs = entity_refs(body);
            if refs.len() != 2 {
                continue;
            }
            let Some(&start) = points.get(&refs[0]) else {
                continue;
            };
            let Some(&(dir_id, magnitude)) = vectors.get(&refs[1]) else {
                continue;
            };
            // The direction inside a VECTOR is a unit DIRECTION entity.
            let Some(&dir) = points.get(&dir_id) else {
                continue;
            };
            segments.push(RawSegment {
                a: [start[0] * scale, start[1] * scale, start[2] * scale],
                b: [
                    (start[0] + dir[0] * magnitude) * scale,
                    (start[1] + dir[1] * magnitude) * scale,
                    (start[2] + dir[2] * magnitude) * scale,
                ],
            });
        } else if body.starts_with("TRIMMED_CURVE") {
            // TRIMMED_CURVE('',#basis,(#trim1),(#trim2),...)
            let refs = entity_refs(body);
            if refs.len() < 3 {
                continue;
            }
            let basis_ok = entities
                .get(&refs[0])
                .is_some_and(|b| b.starts_with("LINE"));
            if !basis_ok {
                continue;
            }
            let (Some(&p1), Some(&p2)) = (points.get(&refs[1]), points.get(&refs[2])) else {
                continue;
            };
            segments.push(RawSegment {
                a: [p1[0] * scale, p1[1] * scale, p1[2] * scale],
                b: [p2[0] * scale, p2[1] * scale, p2[2] * scale],
            });
        }
    }
    retain_nonzero(&mut segments);
    Ok(segments)
}

/// Parses IGES type `110` Line entities from the P (parameter) section.
fn import_iges(bytes: &[u8]) -> Result<Vec<RawSegment>, CadError> {
    let text = String::from_utf8_lossy(bytes);
    let mut p_params: Vec<(u32, String)> = Vec::new();
    let mut g_params = String::new();
    for line in text.lines() {
        let bytes_line = line.as_bytes();
        if bytes_line.len() < 73 {
            continue;
        }
        // v1.7.0 fuzz hardening: the payload may carry multi-byte UTF-8
        // sequences — every slice goes through `str::get` (char-boundary
        // safe) instead of raw byte indexing.
        let section = bytes_line[72] as char;
        let seq = line
            .get(73..)
            .unwrap_or("")
            .trim()
            .parse::<u32>()
            .unwrap_or(u32::MAX);
        match section {
            'P' => {
                if let Some(head) = line.get(..64) {
                    p_params.push((seq, head.to_owned()));
                }
            }
            'G' => {
                if let Some(head) = line.get(..72) {
                    g_params.push_str(head.trim());
                }
            }
            _ => {}
        }
    }
    if p_params.is_empty() {
        return Err(CadError::Parse(
            "IGES payload has no P-section data".to_owned(),
        ));
    }
    p_params.sort_by_key(|(seq, _)| *seq);
    let concatenated: String = p_params.into_iter().map(|(_, s)| s).collect();

    // Unit declaration: the G-section unit indicator (`2HMM`, `6HMILLIM`,
    // ...) — millimetres convert to metres.
    let g_upper = g_params.to_uppercase();
    let scale = if g_upper.contains("2HMM") || g_upper.contains("HMILLIM") {
        1e-3
    } else {
        1.0
    };

    let mut segments: Vec<RawSegment> = Vec::new();
    for statement in concatenated.split(';') {
        let statement = statement.trim();
        if !statement.starts_with("110,") {
            continue;
        }
        let fields: Vec<f64> = statement[4..]
            .split(',')
            .filter_map(parse_iges_number)
            .collect();
        if fields.len() < 6 {
            continue;
        }
        segments.push(RawSegment {
            a: [fields[0] * scale, fields[1] * scale, fields[2] * scale],
            b: [fields[3] * scale, fields[4] * scale, fields[5] * scale],
        });
    }
    retain_nonzero(&mut segments);
    Ok(segments)
}

/// Drops degenerate (zero-length) segments.
fn retain_nonzero(segments: &mut Vec<RawSegment>) {
    segments.retain(|s| {
        let d = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]];
        (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt() > 1e-9
    });
}

/// Extracts the innermost `(x, y, z)` numeric triple from an entity body.
fn numeric_triple(body: &str) -> Option<[f64; 3]> {
    let open = body.rfind('(')?;
    let inner = &body[open + 1..];
    // The coordinate group closes at the FIRST ')' after the values; a
    // rfind would swallow the entity's own closing paren.
    let close = inner.find(')')?;
    let fields: Vec<f64> = inner[..close]
        .split(',')
        .filter_map(|f| {
            let value = f.trim();
            if value.is_empty() {
                None
            } else {
                value.parse::<f64>().ok()
            }
        })
        .collect();
    if fields.len() < 3 {
        return None;
    }
    Some([fields[0], fields[1], fields[2]])
}

/// Collects every `#n` entity reference in a body, in order.
fn entity_refs(body: &str) -> Vec<u32> {
    let mut refs = Vec::new();
    let bytes = body.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'#' {
            let mut j = i + 1;
            while j < bytes.len() && bytes[j].is_ascii_digit() {
                j += 1;
            }
            if j > i + 1 {
                if let Ok(id) = body[i + 1..j].parse::<u32>() {
                    refs.push(id);
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }
    refs
}

/// Parses the last standalone number in a VECTOR body (its magnitude).
fn trailing_number(body: &str) -> Option<f64> {
    body.rsplit(',')
        .next()
        .and_then(|f| f.trim().trim_end_matches(')').parse::<f64>().ok())
}

/// IGES numbers use Fortran `D` exponents (`0.10000000D+04`).
fn parse_iges_number(field: &str) -> Option<f64> {
    let value = field.trim().replace(['D', 'd'], "E");
    if value.is_empty() {
        return None;
    }
    value.parse::<f64>().ok()
}

#[cfg(test)]
mod step_iges_tests {
    use super::*;

    /// Two millimetre LINE entities + one TRIMMED_CURVE along the first.
    const STEP_MM: &str = r"ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('RDM wireframe'),'2;1');
ENDSEC;
DATA;
#1=CARTESIAN_POINT('',(0.,0.,0.));
#2=DIRECTION('',(1.,0.,0.));
#3=VECTOR('',#2,4000.);
#4=LINE('',#1,#3);
#5=CARTESIAN_POINT('',(4000.,0.,0.));
#6=DIRECTION('',(0.,0.,1.));
#7=VECTOR('',#6,3000.);
#8=LINE('',#5,#7);
#9=CARTESIAN_POINT('',(0.,0.,0.));
#10=CARTESIAN_POINT('',(0.,3000.,0.));
#11=TRIMMED_CURVE('',#4,(#9),(#10),.T.,.UNSPECIFIED.);
#12=(NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.)LENGTH_UNIT());
ENDSEC;
END-ISO-10303-21;
";

    #[test]
    fn step_extracts_lines_and_trimmed_curves_in_metres() {
        let segments = import_step_or_iges(STEP_MM.as_bytes()).expect("import");
        assert_eq!(segments.len(), 3, "2 LINE + 1 TRIMMED_CURVE");
        assert!(
            segments
                .iter()
                .any(|s| { (s.a[0] - 0.0).abs() < 1e-9 && (s.b[0] - 4.0).abs() < 1e-9 }),
            "4000 mm x-direction LINE must become 0 -> 4 m, got {segments:?}"
        );
        assert!(
            segments.iter().any(|s| { (s.b[2] - 3.0).abs() < 1e-9 }),
            "3000 mm z LINE must end at z = 3 m, got {segments:?}"
        );
    }

    #[test]
    fn step_rejects_garbage() {
        assert!(import_step_or_iges(b"junk bytes").is_err());
    }

    #[test]
    fn step_rejects_empty_model() {
        let empty = "ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n";
        assert!(matches!(
            import_step_or_iges(empty.as_bytes()),
            Err(CadError::Empty)
        ));
    }

    /// Builds one fixed-width (80-column) IGES record.
    fn iges_record(section: char, seq: u32, data: &str) -> String {
        let mut line = data.chars().take(72).collect::<String>();
        while line.chars().count() < 72 {
            line.push(' ');
        }
        format!("{line}{section}{seq:>7}\n")
    }

    #[test]
    fn iges_extracts_type_110_lines_in_metres() {
        let mut iges = String::new();
        iges.push_str(&iges_record('S', 1, "RDM Studio wireframe export"));
        iges.push_str(&iges_record(
            'G',
            1,
            "1H,,1H;,1H;,2HMM,1,308,15,2HMM,1.0,2HMM,15.,1.HMS;",
        ));
        iges.push_str(&iges_record('P', 1, "110,0.,0.,0.,4000.,0.,0.;"));
        iges.push_str(&iges_record('P', 2, "110,4000.,0.,0.,4000.,3000.,0.;"));
        iges.push_str(&iges_record('T', 1, ""));
        let segments = import_step_or_iges(iges.as_bytes()).expect("import");
        assert_eq!(segments.len(), 2);
        assert!(
            segments
                .iter()
                .any(|s| { (s.a[0] - 0.0).abs() < 1e-9 && (s.b[0] - 4.0).abs() < 1e-9 }),
            "first 110 entity must become 0 -> 4 m, got {segments:?}"
        );
        assert!(
            segments
                .iter()
                .any(|s| { (s.b[1] - 3.0).abs() < 1e-9 && (s.a[0] - 4.0).abs() < 1e-9 }),
            "second 110 entity must run to y = 3 m, got {segments:?}"
        );
    }
}
