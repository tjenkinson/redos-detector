import { RedosDetectorTrail } from './redos-detector';
import { toFriendly } from './to-friendly';

describe('toFriendly', () => {
  const mockTrails: RedosDetectorTrail[] = [
    {
      trail: [
        {
          a: {
            backreferenceStack: [],
            node: {
              end: { offset: 4 },
              source: 'a',
              start: {
                offset: 3,
              },
            },
            quantifierIterations: [],
          },
          b: {
            backreferenceStack: [],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
        },
      ],
    },
    {
      trail: [
        {
          a: {
            backreferenceStack: [],
            node: {
              end: { offset: 4 },
              source: 'a',
              start: {
                offset: 3,
              },
            },
            quantifierIterations: [],
          },
          b: {
            backreferenceStack: [],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
        },
      ],
    },
    {
      trail: [
        {
          a: {
            backreferenceStack: [],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
          b: {
            backreferenceStack: [],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
        },
        {
          a: {
            backreferenceStack: [
              {
                index: 1,
                node: {
                  end: {
                    offset: 6,
                  },
                  source: '\\1',
                  start: {
                    offset: 4,
                  },
                },
              },
            ],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
          b: {
            backreferenceStack: [
              {
                index: 1,
                node: {
                  end: {
                    offset: 6,
                  },
                  source: '\\1',
                  start: {
                    offset: 4,
                  },
                },
              },
            ],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
        },
        {
          a: {
            backreferenceStack: [
              {
                index: 1,
                node: {
                  end: {
                    offset: 6,
                  },
                  source: '\\1',
                  start: {
                    offset: 4,
                  },
                },
              },
              {
                index: 2,
                node: {
                  end: {
                    offset: 10,
                  },
                  source: '\\2',
                  start: {
                    offset: 8,
                  },
                },
              },
            ],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
          b: {
            backreferenceStack: [
              {
                index: 1,
                node: {
                  end: {
                    offset: 6,
                  },
                  source: '\\1',
                  start: {
                    offset: 4,
                  },
                },
              },
              {
                index: 2,
                node: {
                  end: {
                    offset: 10,
                  },
                  source: '\\2',
                  start: {
                    offset: 8,
                  },
                },
              },
            ],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [],
          },
        },
        {
          a: {
            backreferenceStack: [
              {
                index: 1,
                node: {
                  end: {
                    offset: 6,
                  },
                  source: '\\1',
                  start: {
                    offset: 4,
                  },
                },
              },
              {
                index: 2,
                node: {
                  end: {
                    offset: 10,
                  },
                  source: '\\2',
                  start: {
                    offset: 8,
                  },
                },
              },
              {
                index: 3,
                node: {
                  end: {
                    offset: 13,
                  },
                  source: '\\3',
                  start: {
                    offset: 11,
                  },
                },
              },
            ],
            node: {
              end: {
                offset: 2,
              },
              source: 'a',
              start: {
                offset: 1,
              },
            },
            quantifierIterations: [
              {
                iteration: 0,
                node: {
                  end: {
                    offset: 14,
                  },
                  source: '\\3?',
                  start: {
                    offset: 11,
                  },
                },
              },
            ],
          },
          b: {
            backreferenceStack: [],
            node: {
              end: {
                offset: 15,
              },
              source: 'a',
              start: {
                offset: 14,
              },
            },
            quantifierIterations: [
              {
                iteration: 0,
                node: {
                  end: {
                    offset: 16,
                  },
                  source: 'a?',
                  start: {
                    offset: 14,
                  },
                },
              },
            ],
          },
        },
      ],
    },
  ];

  [false, true].forEach((alwaysIncludeTrails) => {
    describe(`with alwaysIncludeTrails=${
      alwaysIncludeTrails ? 'true' : 'false'
    }`, () => {
      it('returns the correct string when safe', () => {
        expect(
          toFriendly(
            {
              error: null,
              pattern: 'pattern',
              patternDowngraded: false,
              safe: true,
              trails: [],
              worstCaseBacktrackCount: { infinite: false, value: 1 },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: null,
              pattern: 'pattern',
              patternDowngraded: false,
              safe: true,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: false, value: 2 },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: null,
              pattern: 'pattern',
              patternDowngraded: false,
              safe: true,
              trails: [],
              // not really possible bug needed for coverage
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
      });

      it('returns the correct string when not safe but no trails', () => {
        expect(
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: [],
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'timedOut',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: [],
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'stackOverflow',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: [],
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: mockTrails,
              // not really possible but needed for coverage
              worstCaseBacktrackCount: { infinite: false, value: 0 },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
      });

      it('returns the correct string when not safe', () => {
        expect(
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: [mockTrails[0]],
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'timedOut',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxBacktracks',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxBacktracks',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: false, value: 1 },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxBacktracks',
              pattern: 'pattern',
              patternDowngraded: false,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: false, value: 2 },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: true,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: true,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails, resultsLimit: 0 },
          ),
        ).toMatchSnapshot();
        expect(
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: true,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails, resultsLimit: 1 },
          ),
        ).toMatchSnapshot();
      });

      it('throws if `resultsLimit` is < 0', () => {
        expect(() =>
          toFriendly(
            {
              error: 'hitMaxSteps',
              pattern: 'pattern',
              patternDowngraded: true,
              safe: false,
              trails: mockTrails,
              worstCaseBacktrackCount: { infinite: true },
            },
            { alwaysIncludeTrails, resultsLimit: -1 },
          ),
        ).toThrowError('`resultsLimit` must be > 0.');
      });
    });
  });
});
