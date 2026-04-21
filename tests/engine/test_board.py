from __future__ import annotations

from engine.board import (
    HEX_DIRECTIONS, INITIAL_DISCS, INITIAL_CORNERS,
    hex_neighbors, hex_distance, is_adjacent,
    is_connected, edge_discs, removable_discs, valid_placements,
)


def test_hex_directions_count():
    assert len(HEX_DIRECTIONS) == 6


def test_initial_discs_count():
    assert len(INITIAL_DISCS) == 19


def test_initial_corners_count():
    assert len(INITIAL_CORNERS) == 6


def test_initial_corners_are_in_initial_discs():
    assert INITIAL_CORNERS.issubset(INITIAL_DISCS)


def test_hex_neighbors_count():
    assert len(hex_neighbors((0, 0))) == 6


def test_hex_neighbors_of_origin():
    assert set(hex_neighbors((0, 0))) == {(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)}


def test_hex_distance_zero():
    assert hex_distance((0, 0), (0, 0)) == 0


def test_hex_distance_adjacent():
    assert hex_distance((0, 0), (1, 0)) == 1


def test_hex_distance_two_steps():
    assert hex_distance((0, 0), (2, 0)) == 2


def test_is_adjacent_true():
    assert is_adjacent((0, 0), (1, 0))


def test_is_adjacent_false():
    assert not is_adjacent((0, 0), (2, 0))


def test_is_connected_single():
    assert is_connected(frozenset({(0, 0)}))


def test_is_connected_two_adjacent():
    assert is_connected(frozenset({(0, 0), (1, 0)}))


def test_is_connected_two_non_adjacent():
    assert not is_connected(frozenset({(0, 0), (2, 0)}))


def test_is_connected_initial_board():
    assert is_connected(INITIAL_DISCS)


def test_edge_discs_subset_of_discs():
    assert edge_discs(INITIAL_DISCS).issubset(INITIAL_DISCS)


def test_center_not_in_edge_discs():
    assert (0, 0) not in edge_discs(INITIAL_DISCS)


def test_corners_are_edge_discs():
    edges = edge_discs(INITIAL_DISCS)
    assert INITIAL_CORNERS.issubset(edges)


def test_removable_discs_excludes_occupied():
    occupied = INITIAL_CORNERS
    removable = removable_discs(INITIAL_DISCS, occupied)
    assert removable.isdisjoint(occupied)


def test_removable_discs_stay_connected():
    occupied = INITIAL_CORNERS
    for pos in removable_discs(INITIAL_DISCS, occupied):
        assert is_connected(INITIAL_DISCS - {pos})


def test_valid_placements_touch_two_discs():
    remaining = INITIAL_DISCS - {(2, 0)}
    for pos in valid_placements(remaining, excluded=(2, 0)):
        count = sum(1 for n in hex_neighbors(pos) if n in remaining)
        assert count >= 2


def test_valid_placements_not_in_remaining():
    remaining = INITIAL_DISCS - {(2, 0)}
    for pos in valid_placements(remaining, excluded=(2, 0)):
        assert pos not in remaining


def test_valid_placements_excludes_original():
    remaining = INITIAL_DISCS - {(2, 0)}
    placements = valid_placements(remaining, excluded=(2, 0))
    assert (2, 0) not in placements
