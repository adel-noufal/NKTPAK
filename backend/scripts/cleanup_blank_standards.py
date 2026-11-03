"""Remove standards rows whose identifier, title, and scope are all blank."""

from sqlalchemy import text

from app.core.database import engine


def main() -> None:
    with engine.begin() as connection:
        rows = connection.execute(text("""SELECT entry_id FROM standards_catalog
            WHERE TRIM(COALESCE(standard_identifier, '')) = ''
              AND TRIM(COALESCE(title, '')) = ''
              AND TRIM(COALESCE(scope_summary, '')) = ''""")).scalars().all()
        if not rows:
            print("No blank standards rows found.")
            return
        result = connection.execute(text("""DELETE FROM standards_catalog
            WHERE TRIM(COALESCE(standard_identifier, '')) = ''
              AND TRIM(COALESCE(title, '')) = ''
              AND TRIM(COALESCE(scope_summary, '')) = ''"""))
        print(f"Removed {result.rowcount} blank standards row(s): {', '.join(rows)}")


if __name__ == "__main__":
    main()
