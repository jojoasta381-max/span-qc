import pytest
from spanqc_core.wirecodes import WireLabel, colour_is_valid, norm_size
from spanqc_core.classify import ComponentIndex, DestClass, classify_destination, strip_parenthetical


@pytest.mark.parametrize("text,exp", [("122A WH 1.5", ("122A", "WH", "1.5")), ("5 RD/OG 0.75", ("5", "RD/OG", "0.75")),
                                      ("7 BK 2.0", ("7", "BK", "2")), ("9 gn 1", None), ("CN-36", None),
                                      ("122A WH", ("122A", "WH", None)), ("WH 2.0", (None, "WH", "2")), ("4 RD", ("4", "RD", None)),
                                      ("G18 BK 0.75", ("G18", "BK", "0.75")), ("WH", None), ("AB 1.5", None), ("88 RD/YE 1.5", ("88", "RD/YE", "1.5"))])
def test_label_parse(text, exp):
    lab = WireLabel.parse(text)
    assert (None if lab is None else (lab.wire_no, lab.colour, lab.size)) == exp


@pytest.mark.parametrize("a,b", [("2", "2.0"), ("1", "1.00"), ("0.75", "0.750"), ("1.5 mm2", "1.5"), ("10", "10.0")])
def test_sizes_compare_numerically(a, b):
    assert norm_size(a) == norm_size(b) is not None


@pytest.mark.parametrize("bad", [None, "", "abc", "0", "-1", "nan", "inf"])
def test_bad_sizes_are_none(bad):
    assert norm_size(bad) is None


def test_colour_validity():
    assert colour_is_valid("WH/RD") and colour_is_valid("BK") and not colour_is_valid("XX") and not colour_is_valid("WH/RD/BK")


def test_strip_parenthetical_before_lookup():
    assert strip_parenthetical("CECM:CN-93(4)") == "CECM:CN-93"
    assert strip_parenthetical("CFB1 (pin 3)") == "CFB1"


def test_classification_classes():
    idx = ComponentIndex(in_scope={"CFB1"}, known={"CECM", "CMCU"})
    assert classify_destination("CFB1(7)", idx) == DestClass.GREEN
    assert classify_destination("CECM:CN-93(4)", idx) == DestClass.YELLOW
    assert classify_destination("KL30", idx) == DestClass.BLUE
    assert classify_destination("CZZZ:CN-1(2)", idx) == DestClass.GREY
    assert classify_destination(None, idx) == DestClass.GREY and classify_destination("  ", idx) == DestClass.GREY
