import { once } from './once';

describe('Once', () => {
  describe('once', () => {
    [1, undefined].map((value) => {
      it(`works when returning ${String(value)}`, () => {
        const impl = jest.fn();
        impl.mockReturnValue(value);

        const fn = once(impl);

        expect(impl).toHaveBeenCalledTimes(0);
        expect(fn()).toBe(value);
        expect(impl).toHaveBeenCalledTimes(1);
        expect(fn()).toBe(value);
        expect(impl).toHaveBeenCalledTimes(1);
      });
    });
  });
});
