from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "access_events.csv"

df = pd.read_csv(DATA_PATH)

print("Dimensions :", df.shape)
print(df.head())
