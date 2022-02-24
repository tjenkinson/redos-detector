import { RedosDetectorTrail } from './redos-detector';
import { toFriendly } from './to-friendly';

describe('toFriendly', () => {
  const mockTrails: RedosDetectorTrail[] = [
    {
      trail: [
        {
          a: {
            backReferenceStack: [],
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
            backReferenceStack: [],
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
  ];

  it('returns the correct string when safe', () => {
    expect(
      toFriendly({
        error: null,
        pattern: 'pattern',
        patternDowngraded: false,
        safe: true,
        trails: [],
        worstCaseBackTrackCount: { infinite: false, value: 1 },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: null,
        pattern: 'pattern',
        patternDowngraded: false,
        safe: true,
        trails: [],
        worstCaseBackTrackCount: { infinite: false, value: 2 },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: null,
        pattern: 'pattern',
        patternDowngraded: false,
        safe: true,
        trails: [],
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
  });

  it('returns the correct string when not safe but no trails', () => {
    expect(
      toFriendly({
        error: 'hitMaxSteps',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: [],
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: 'timedOut',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: [],
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: 'stackOverflow',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: [],
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
  });

  it('returns the correct string when not safe', () => {
    expect(
      toFriendly({
        error: 'hitMaxSteps',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: mockTrails,
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: 'timedOut',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: mockTrails,
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: 'hitMaxBacktracks',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: mockTrails,
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: 'hitMaxBacktracks',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: mockTrails,
        worstCaseBackTrackCount: { infinite: false, value: 1 },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: 'hitMaxBacktracks',
        pattern: 'pattern',
        patternDowngraded: false,
        safe: false,
        trails: mockTrails,
        worstCaseBackTrackCount: { infinite: false, value: 2 },
      })
    ).toMatchSnapshot();
    expect(
      toFriendly({
        error: 'hitMaxSteps',
        pattern: 'pattern',
        patternDowngraded: true,
        safe: false,
        trails: mockTrails,
        worstCaseBackTrackCount: { infinite: true },
      })
    ).toMatchSnapshot();
  });
});
