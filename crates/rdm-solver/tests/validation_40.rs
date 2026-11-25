//! v1.7.0 G5: the closed-form validation suite must count >= 40
//! benchmarks and pass ALL of them inside the 3 % relative tolerance.

use rdm_solver::run_validation_suite;

#[test]
fn validation_suite_has_at_least_40_benchmarks() {
    let results = run_validation_suite();
    assert!(
        results.len() >= 40,
        "only {} benchmarks in the suite",
        results.len()
    );
    let mut ids: Vec<&str> = results.iter().map(|r| r.id).collect();
    ids.sort_unstable();
    assert_eq!(ids.len(), results.len(), "duplicate benchmark ids");
}

#[test]
fn validation_suite_passes_completely() {
    let failures: Vec<String> = run_validation_suite()
        .iter()
        .filter(|r| !r.passed)
        .map(|f| {
            format!(
                "{} {}: expected {:.4}, computed {:.4} (rel {:.2e})",
                f.id, f.title, f.expected, f.computed, f.rel_error
            )
        })
        .collect();
    assert!(failures.is_empty(), "failing benchmarks: {failures:?}");
}
