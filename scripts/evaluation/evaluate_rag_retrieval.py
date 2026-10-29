from rag.retriever import retrieve_chunks


EVALUATION_CASES = [
    {
        "name": "Impossible travel",
        "question": (
            "What should an analyst investigate when one account appears "
            "to connect from two distant countries within a short time?"
        ),
        "expected_source": (
            "knowledge/security_playbooks/impossible_travel.md"
        ),
    },
    {
        "name": "Repeated failed logins",
        "question": (
            "How should repeated authentication failures followed by "
            "a successful login be investigated?"
        ),
        "expected_source": (
            "knowledge/security_playbooks/repeated_failed_logins.md"
        ),
    },
    {
        "name": "New device",
        "question": (
            "What should we check when a user signs in from an unfamiliar device?"
        ),
        "expected_source": (
            "knowledge/security_playbooks/new_device_access.md"
        ),
    },
]


def evaluate_retrieval(top_k: int = 3) -> None:
    hits = 0
    reciprocal_ranks = []

    print("=" * 68)
    print("IDENTITYSHIELD AI - RAG RETRIEVAL EVALUATION")
    print(f"Number of queries: {len(EVALUATION_CASES)}")
    print(f"Evaluation metric: Hit@{top_k} and MRR@{top_k}")
    print("=" * 68)

    for case in EVALUATION_CASES:
        results = retrieve_chunks(case["question"], top_k=top_k)

        expected = case["expected_source"]
        rank = next(
            (
                position
                for position, result in enumerate(results, start=1)
                if result["source"] == expected
            ),
            None,
        )

        hit = rank is not None
        hits += int(hit)
        reciprocal_ranks.append(1 / rank if rank is not None else 0.0)

        print(f"\nScenario: {case['name']}")
        print(f"Expected source: {expected}")
        print(f"Expected source rank: {rank if rank is not None else 'NOT FOUND'}")
        print(f"Hit@{top_k}: {'PASS' if hit else 'FAIL'}")

        for position, result in enumerate(results, start=1):
            print(
                f"  {position}. {result['title']} "
                f"| {result['section']} "
                f"| distance={result['distance']:.4f}"
            )

    total = len(EVALUATION_CASES)
    hit_at_k = hits / total
    mrr_at_k = sum(reciprocal_ranks) / total

    print("\n" + "=" * 68)
    print(f"Hit@{top_k}: {hits}/{total} ({hit_at_k:.1%})")
    print(f"MRR@{top_k}: {mrr_at_k:.3f}")
    print("=" * 68)


if __name__ == "__main__":
    evaluate_retrieval()
