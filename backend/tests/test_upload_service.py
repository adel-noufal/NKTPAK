"""
Tests for Upload Service (CAD / 3D format parsing and error handling).
"""

from app.services.upload_service import parse_uploaded_file, _dwg_error


def test_dwg_returns_honest_error():
    res = parse_uploaded_file("drawing.dwg", b"fake binary dwg content")
    assert res.success is False
    assert res.file_type == "dwg"
    assert "DWG files cannot be read by free open-source libraries" in (res.error or "")
    assert "DXF or STEP" in (res.error or "")


def test_file_size_limit_exceeded():
    # 51 MB dummy
    huge_bytes = b"x" * (51 * 1024 * 1024)
    res = parse_uploaded_file("huge.stl", huge_bytes)
    assert res.success is False
    assert "too large" in (res.error or "")


def test_unsupported_format():
    res = parse_uploaded_file("model.xyz", b"some bytes")
    assert res.success is False
    assert "Unsupported file format" in (res.error or "")


def test_stl_box_parsing():
    import trimesh
    mesh = trimesh.creation.box(extents=(20.0, 30.0, 40.0))
    stl_bytes = mesh.export(file_type="stl")
    res = parse_uploaded_file("sample_box.stl", stl_bytes)
    assert res.success is True
    assert res.file_type == "stl"
    assert len(res.components) >= 1
    comp = res.components[0]
    assert comp.name == "sample_box"
    assert comp.length_mm == 20.0
    assert comp.width_mm == 30.0
    assert comp.height_mm == 40.0
