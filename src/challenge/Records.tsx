import { memo, useEffect, useState } from 'react';
import { challengeApi } from './api';
import { PAGE_SIZE, type PassageChoice, type RaceRecord, type RankingRecord } from './types';

interface Props { choice: PassageChoice; revision: number; playerId: string | undefined; onDeleted(): void }
/** Independent from the 50ms race snapshot. No polling and no per-keystroke requests. */
export const Records = memo(function Records({ choice, revision, playerId, onDeleted }: Props) {
  const [tab, setTab] = useState<'ranking' | 'mine'>('ranking');
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  const [rows, setRows] = useState<(RaceRecord | RankingRecord)[]>([]), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false), [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setRows([]); setConfirm(false);
    if (tab === 'mine' && !playerId) { setLoading(false); setHasMore(false); return; }
    const load = tab === 'ranking' ? challengeApi.leaderboard(choice, offset) : challengeApi.records(choice, offset);
    void load.then(page => { if (current) { setRows(page.items); setHasMore(page.hasMore); } }).catch(error => { if (current) setError(error.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [choice, revision, playerId, tab, offset, retry]);
  const remove = async () => {
    setDeleting(true); setError('');
    try { await challengeApi.deleteRecords(); setOffset(0); setConfirm(false); onDeleted(); }
    catch (error) { setError(error instanceof Error ? error.message : '삭제 실패. 다시 시도해 주세요.'); }
    finally { setDeleting(false); }
  };
  return <div className="challenge-records" data-keyboard-controls>
    <div className="records-tabs" role="tablist" aria-label="기록 보기">
      <button id="ranking-tab" type="button" role="tab" aria-selected={tab === 'ranking'} aria-controls="records-panel" onClick={() => { setTab('ranking'); setOffset(0); }}>순위</button>
      <button id="mine-tab" type="button" role="tab" aria-selected={tab === 'mine'} aria-controls="records-panel" onClick={() => { setTab('mine'); setOffset(0); }}>내 기록</button>
    </div>
    <div id="records-panel" role="tabpanel" aria-labelledby={tab === 'ranking' ? 'ranking-tab' : 'mine-tab'} aria-busy={loading}>
      {error ? <p className="records-message" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></p> : loading ? <p className="records-message" role="status">불러오는 중…</p> : rows.length ? <div className="records-scroll"><table aria-label={tab === 'ranking' ? '순위표' : '내 기록 목록'}>
        <thead><tr>{tab === 'ranking' ? <><th scope="col">순위</th><th scope="col">닉네임</th></> : <th scope="col">날짜</th>}<th scope="col">글자/초</th><th scope="col">정확도</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className={'isMe' in row && row.isMe ? 'record--mine' : undefined}>
          {'rank' in row ? <><td><span className="record-rank" data-podium={row.rank <= 3 ? row.rank : undefined}>{row.rank}</span></td><td>{row.nickname}{row.isMe ? <span className="record-you">나</span> : null}</td></> : <td><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></td>}
          <td>{row.result.speed.toFixed(2)}</td><td>{row.result.accuracy.toFixed(1)}%</td>
        </tr>)}</tbody>
      </table></div> : <p className="records-message records-empty"><span>아직 기록 없음.</span><span>{tab === 'ranking' ? '첫 번째 기록의 주인공이 되어 보세요.' : '한 판 달리면 여기에 쌓여요.'}</span></p>}
      {!loading && !error && (offset > 0 || hasMore) ? <div className="records-pages"><button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}>이전</button><span>{offset / PAGE_SIZE + 1}</span><button type="button" disabled={!hasMore} onClick={() => setOffset(value => value + PAGE_SIZE)}>다음</button></div> : null}
      {tab === 'mine' && playerId && rows.length > 0 ? confirm ? <div className="delete-confirm"><span>내 기록을 모두 삭제할까요?</span><button type="button" disabled={deleting} onClick={() => void remove()}>삭제 확인</button><button type="button" disabled={deleting} onClick={() => setConfirm(false)}>취소</button></div> : <button className="records-delete" type="button" onClick={() => setConfirm(true)}>내 기록 삭제</button> : null}
    </div>
  </div>;
});
