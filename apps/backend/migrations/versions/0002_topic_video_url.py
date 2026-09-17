"""add Topic.videoUrl for topic explainer videos

Additive-only: one nullable column on Topic so a topic can carry a
teaching video (uploaded to Supabase Storage or an external link like
YouTube) alongside its ingested PDF pages.

Revision ID: 0002_topic_video_url
Revises: 0001_new_features
Create Date: 2026-09-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_topic_video_url"
down_revision: Union[str, Sequence[str], None] = "0001_new_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("Topic", sa.Column("videoUrl", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("Topic", "videoUrl")
