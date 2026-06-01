import { listEvents, insertEvent, deleteEventById } from '../db/queries/eventQueries';

const mockQuery = jest.fn();
const mockPool  = { query: mockQuery } as any;

beforeEach(() => mockQuery.mockReset());

describe('listEvents', () => {
  it('조건 없이 전체 목록을 반환한다', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })   // COUNT
      .mockResolvedValueOnce({ rows: [{ id: 'e1' }, { id: 'e2' }] }); // SELECT

    const result = await listEvents(mockPool, { page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.page).toBe(1);
  });

  it('ipId 필터를 WHERE 절에 포함한다', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'e1', ipId: 'ip-1' }] });

    await listEvents(mockPool, { ipId: 'ip-1', page: 1, limit: 20 });

    const countCall = mockQuery.mock.calls[0];
    expect(countCall[0]).toContain('WHERE');
    expect(countCall[1]).toContain('ip-1');
  });
});

describe('insertEvent', () => {
  it('place 없으면 place_url, place_lat, place_lng 가 null로 INSERT 된다', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'new-id', placeUrl: null, placeLat: null, placeLng: null }],
    });

    const result = await insertEvent(mockPool, {
      ipId: 'ip-1', title: '테스트 행사', type: 'popup',
    });

    const sql    = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toContain('INSERT INTO events');
    expect(params[4]).toBeNull(); // placeUrl
    expect(params[5]).toBeNull(); // placeLat
    expect(params[6]).toBeNull(); // placeLng
    expect(result.placeUrl).toBeNull();
  });
});

describe('deleteEventById', () => {
  it('삭제된 행이 있으면 true를 반환한다', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    expect(await deleteEventById(mockPool, 'e1')).toBe(true);
  });

  it('해당 id가 없으면 false를 반환한다', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    expect(await deleteEventById(mockPool, 'no-id')).toBe(false);
  });
});
