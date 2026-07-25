from pydantic import BaseModel, Field


class SnapshotProfile(BaseModel):
    name: str
    age: int
    gender: str
    nhs_number: str = Field(alias="nhsNumber")

    model_config = {"populate_by_name": True}


class SnapshotMedication(BaseModel):
    name: str
    dose: str
    brand: str = ""
    category: str
    schedule_label: str | None = Field(default=None, alias="scheduleLabel")
    times: list[str] = Field(default_factory=list)
    route: str = "Oral"
    status: str

    model_config = {"populate_by_name": True}


class SnapshotInteraction(BaseModel):
    a: str
    b: str
    reason: str


class GpShareSnapshot(BaseModel):
    profile: SnapshotProfile
    last_synced: str = Field(alias="lastSynced")
    medications: list[SnapshotMedication]
    interactions: list[SnapshotInteraction] = Field(default_factory=list)

    model_config = {"populate_by_name": True}
