from app.services.suppai import _score_agent


def test_fish_oils_scores_above_emulsion():
    emulsion = {
        "preferred_name": "Fish Oil/Glycerol/Egg Lecithin-Based Emulsion",
        "ent_type": "supplement",
        "interacts_with_count": 10,
    }
    oils = {
        "preferred_name": "Fish Oils",
        "ent_type": "supplement",
        "interacts_with_count": 80,
    }
    q = "Fish Oil"
    assert _score_agent(oils, q) > _score_agent(emulsion, q)
