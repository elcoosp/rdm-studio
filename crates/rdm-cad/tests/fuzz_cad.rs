//! v1.7.0 fuzz tests: the DXF/STEP parsers never panic on arbitrary bytes.

use rdm_cad::import_cad;

fn xorshift(state: &mut u64) -> u64 {
    *state ^= *state >> 12;
    *state ^= *state << 25;
    *state ^= *state >> 27;
    *state
}

#[test]
fn cad_parsers_never_panic_on_random_bytes() {
    let mut state: u64 = 0x2545_F491_4F6C_DD1D;
    for _round in 0..400_u64 {
        let len = 1 + (xorshift(&mut state) % 4096) as usize;
        let bytes: Vec<u8> = (0..len)
            .map(|_| (xorshift(&mut state) % 256) as u8)
            .collect();
        let name = match xorshift(&mut state) % 3 {
            0 => "fuzz.dxf",
            1 => "fuzz.step",
            _ => "fuzz.igs",
        };
        let _ = import_cad(&bytes, name);
    }
}

#[test]
fn cad_parsers_never_panic_on_truncated_valid_files() {
    let header =
        b"0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n30\n0.0\n11\n1.0\n21\n1.0\n31\n1.0\n0\nENDSEC\n0\nEOF\n";
    for cut in 0..header.len() {
        let _ = import_cad(&header[..cut], "truncated.dxf");
    }
}
