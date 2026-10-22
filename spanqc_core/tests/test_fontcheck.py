import glob, os
from conftest import FIX
from spanqc_core.fontcheck import check_fonts, STANDARDS_PX


def test_clean_sheets_have_no_violations():
    for n in ("FB1-1.svg", "2-1.svg", "2-5.svg", "5.svg"):
        assert check_fonts(FIX / n) == [], n


def test_real_deviation_found_on_sheet_12_1():
    v = check_fonts(FIX / "12-1.svg")
    assert [(x.category, x.text, x.found_px, x.expected_px) for x in v] == [("component code", "CCR1", 8.0, 10.0)]


def test_can_bus_label_is_not_a_component():
    assert all(x.text != "CAN" for x in check_fonts(FIX / "2-5.svg"))


def test_standards_match_the_lms():
    assert STANDARDS_PX == {"KL label": 8.0, "component code": 10.0, "connector code": 7.0, "colour/wire label": 7.0}


def test_custom_standard_flags_everything_in_that_category(tmp_path):
    v = check_fonts(FIX / "FB1-1.svg", {"KL label": 9.0})
    assert v and all(x.category == "KL label" and x.expected_px == 9.0 for x in v)
