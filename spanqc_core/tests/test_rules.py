import pytest
from spanqc_core.rules import Expected, Observation, evaluate, FAIL, PASS, REVIEW

EXP = [Expected("101", "RD", "1.5", "J1:1", "TB1:1"), Expected("102", "BK", "0.75", "J1:2", "TB1:2")]
W102 = Observation("102", "BK", "0.75", "J1:2", "TB1:2")


def ob(no="101", col="RD", size="1.5", s="J1:1", d="TB1:1", conf=0.95):
    return Observation(no, col, size, s, d, conf, f"{no} {col} {size}")


def run(obs, exp=EXP, **kw):
    kw.setdefault("specification_is_complete", True)
    out, f = evaluate(obs, exp, **kw)
    return out, {x["rule_id"] for x in f}


def test_perfect_match_passes():
    assert run([ob(), W102]) == (PASS, set())


@pytest.mark.parametrize("order", [0, 1])
def test_conflicting_duplicates_never_pass_any_order(order):
    pair = [ob(d="TB9:9"), ob()]
    out, ids = run((pair if order == 0 else pair[::-1]) + [W102])
    assert out == REVIEW and ids == {"LMS-02"}


def test_identical_duplicates_ok():
    assert run([ob(), ob(), W102])[0] == PASS


@pytest.mark.parametrize("exp_size,drawn", [("2", "12"), ("20", "120"), ("12", "2"), ("1.5", "1.25")])
def test_size_numeric_not_substring(exp_size, drawn):
    out, ids = run([ob(size=drawn), W102], [Expected("101", "RD", exp_size, "J1:1", "TB1:1"), EXP[1]])
    assert out == FAIL and ids == {"LMS-05"}


@pytest.mark.parametrize("a,b", [("2", "2.0"), ("1", "1.00"), ("0.75", "0.750")])
def test_equal_sizes_in_different_formats_pass(a, b):
    assert run([ob(size=b), W102], [Expected("101", "RD", a, "J1:1", "TB1:1"), EXP[1]])[0] == PASS


@pytest.mark.parametrize("drawn", ["BK/RD", "RD/BK", "WH/RD"])
def test_colour_exact_and_ordered(drawn):
    out, ids = run([ob(col=drawn), W102])
    assert out == FAIL and ids == {"LMS-04"}


def test_stripe_order_matters():
    out, _ = run([ob(col="RD/WH"), W102], [Expected("101", "WH/RD", "1.5", "J1:1", "TB1:1"), EXP[1]])
    assert out == FAIL


def test_reversed_ends_equivalent():
    assert run([ob(s="TB1:1", d="J1:1"), W102])[0] == PASS


def test_wrong_end_fails():
    assert run([ob(d="TB1:7"), W102]) == (FAIL, {"LMS-03"})


def test_terminal_whitespace_and_case():
    assert run([ob(s="j1: 1", d=" tb1:1 "), W102])[0] == PASS


def test_missing_wire_fails():
    assert run([ob()]) == (FAIL, {"LMS-01"})


def test_null_attribute_is_review_not_guess():
    out, ids = run([ob(size=None), W102])
    assert out == REVIEW and ids == {"LMS-09"}


def test_null_endpoint_is_review():
    out, ids = run([ob(d=None), W102])
    assert out == REVIEW and ids == {"LMS-09"}


def test_invalid_colour_code_review():
    out, ids = run([ob(col="XX"), W102])
    assert out == REVIEW and ids == {"LMS-06"}


def test_low_confidence_review():
    assert run([ob(conf=0.3), W102]) == (REVIEW, {"LMS-07"})


def test_unlisted_wire_review():
    assert run([ob(), W102, ob("999", s="J9:9", d="TB9:9")]) == (REVIEW, {"LMS-08"})


def test_empty_extraction_is_review_not_mass_fail():
    assert run([]) == (REVIEW, {"LMS-12"})


def test_partial_coverage_never_passes():
    assert run([ob(), W102], total_pages=2, processed_pages=1, failed_pages=[2])[0] == REVIEW


def test_incomplete_spec_never_passes():
    assert run([ob(), W102], specification_is_complete=False)[0] == REVIEW


def test_fail_beats_review():
    out, ids = run([ob(col="BK/RD", conf=0.95), W102, ob("999")])
    assert out == FAIL


def test_duplicate_reference_wire_is_error():
    with pytest.raises(ValueError):
        evaluate([], [EXP[0], EXP[0]])


def test_observation_without_wire_no_flagged():
    out, ids = run([ob(), W102, Observation(None, "RD", "1.5")])
    assert out == REVIEW and "LMS-09" in ids
