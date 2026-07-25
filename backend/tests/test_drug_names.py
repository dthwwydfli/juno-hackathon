from app.services.drug_names import lookup_query_variants, primary_lookup_name


def test_fish_oil_prefers_ingredient_phrase():
    variants = lookup_query_variants("Fish oil 1000mg capsules")
    assert variants[0].lower() == "fish oil"
    assert primary_lookup_name("Fish oil 1000mg capsules") == "Fish Oil"


def test_warfarin_strips_strength_and_form():
    assert primary_lookup_name("Warfarin 3mg tablets").lower() == "warfarin"


def test_sample_pack_paracetamol():
    name = primary_lookup_name("Paracetamol 500mg tablets (sample)")
    assert "500" not in name
    assert name.lower().startswith("paracetamol")


def test_ginkgo_multi_word():
    assert "Ginkgo Biloba" in lookup_query_variants("Ginkgo biloba 120mg tablets")
