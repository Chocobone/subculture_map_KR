import { searchPlace } from '../services/naverMapsService';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NAVER_CLIENT_ID     = 'test-id';
  process.env.NAVER_CLIENT_SECRET = 'test-secret';
});

describe('searchPlace', () => {
  it('장소 발견 시 placeUrl과 WGS84 좌표를 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        items: [{
          link: 'https://map.naver.com/v5/entry/place/12345678',
          mapx: '1269238190',  // 126.923819
          mapy:  '375565270',  //  37.556527
        }],
      }),
    });

    const result = await searchPlace('홍대입구역');

    expect(result).not.toBeNull();
    expect(result!.placeUrl).toBe('https://map.naver.com/v5/entry/place/12345678');
    expect(result!.placeLng).toBeCloseTo(126.923819, 4);
    expect(result!.placeLat).toBeCloseTo(37.556527,  4);
  });

  it('검색 결과가 없으면 null을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ items: [] }),
    });

    const result = await searchPlace('존재하지않는장소xyz');
    expect(result).toBeNull();
  });

  it('API 응답이 실패하면 null을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await searchPlace('홍대');
    expect(result).toBeNull();
  });

  it('NAVER_CLIENT_ID가 없으면 null을 반환한다', async () => {
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;
    delete process.env.NAVER_SECRET_ARN;

    const result = await searchPlace('홍대');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
