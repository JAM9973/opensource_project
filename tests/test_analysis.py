import unittest
from backend.analysis import aggregate


class AggregationTests(unittest.TestCase):
    def test_first_and_last_frame_have_duration(self):
        r = aggregate([(0, {'T1': 2}), (0.5, {'T1': 2})], ['T1'], 1)
        self.assertEqual(r['table_sessions'][0]['duration_seconds'], 1)
        self.assertEqual(r['time_series'][0]['average_people'], 2)

    def test_gap_merges_short_absence_and_splits_long_absence(self):
        samples = [(i, {'T1': 1 if i in (0, 2, 8) else 0}) for i in range(9)]
        sessions = aggregate(samples, ['T1'], 9)['table_sessions']
        self.assertEqual(len(sessions), 2)
        self.assertEqual(sessions[0]['duration_seconds'], 3)

    def test_weighted_bucket_boundary(self):
        r = aggregate([(0, {'T1': 0}), (59.5, {'T1': 2})], ['T1'], 61)
        self.assertAlmostEqual(r['time_series'][0]['average_people'], 1/60)
        self.assertEqual(r['time_series'][1]['occupancy_rate'], 1)

    def test_empty_tables_and_zero_occupancy(self):
        r = aggregate([(0, {'T1': 0, 'T2': 0})], ['T1','T2'], 1)
        self.assertEqual(r['table_sessions'], [])
        self.assertEqual(r['table_summary'][0]['session_count'], 0)

if __name__ == '__main__':
    unittest.main()
