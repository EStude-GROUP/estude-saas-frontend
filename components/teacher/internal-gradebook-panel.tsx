"use client";
import { defineToolbarFilter, ResponsiveFilterToolbar } from "@/components/ui/responsive-filter-toolbar";
import { useEffect, useState } from 'react';
import { academicDataService } from '@/lib/assessment-api';
import { gradebookService } from '@/lib/gradebook-api';
import { usePermissions } from '@/context/permissions-context';
import type { TeacherAssignedClass, Term } from '@/types/assessment';
import type { GradebookView } from '@/types/gradebook';
import { UnifiedGradeItems } from './unified-grade-items';
import { Select, Input } from "@/components/ui/form-control";


export function InternalGradebookPanel({ schoolClass }: { schoolClass: TeacherAssignedClass }) {
  const { can } = usePermissions();
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState('');
  const [subjectId, setSubjectId] = useState(schoolClass.subjects[0]?.id ?? '');
  const [view, setView] = useState<GradebookView | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    setTerms([]); setTermId('');
    academicDataService.getTerms(schoolClass.academicYearId, true).then((rows) => {
      if (!active) return;
      rows=schoolClass.courseTermId? rows.filter((term)=>term.id===schoolClass.courseTermId):rows;
      setTerms(rows); setTermId(rows.find((t) => t.status === 'ACTIVE')?.id ?? [...rows].filter((t) => t.status !== 'UPCOMING').sort((a, b) => b.displayOrder - a.displayOrder)[0]?.id ?? rows[0]?.id ?? '');
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Không tải được học kỳ'); });
    return () => { active = false; };
  }, [schoolClass.academicYearId,schoolClass.courseTermId]);
  useEffect(() => {
    let active = true;
    setView(null); setError('');
    if (!termId || !subjectId) return;
    setLoading(true);
    gradebookService.get({ classId: schoolClass.id, subjectId, termId }).then((v) => { if (active) setView(v); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : 'Không tải được kết quả'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [schoolClass.id, termId, subjectId, refresh]);
  const disabled = !can('teaching.update') && !can('academic.update') || !view || !['ACTIVE', 'COMPLETED'].includes(view.term.status) || view.year?.status === 'COMPLETED' || view.schoolClass?.isActive === false;
  const filtered = view ? { ...view, items:view.items.filter((item)=>item.resultChannel!=="OFFICIAL"), students: view.students.filter((s) => `${s.fullName} ${s.accountName}`.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN'))) } : null;
  const field = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
  return <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
    <div><h2 className="font-bold">Kết quả tự học</h2><p className="text-sm text-slate-500">Mỗi bài đánh giá thường xuyên tính một lần. Học sinh và phụ huynh chỉ thấy kết quả đã công bố.</p></div>
    <ResponsiveFilterToolbar search={<Input containerClassName="search-field" className={field} aria-label="Tìm học sinh tự học" placeholder="Tìm học sinh hoặc tài khoản" value={search} onChange={(event)=>setSearch(event.target.value)} />} filters={[defineToolbarFilter({ id:"subject", label:"Môn học", width:220, active:subjectId !== schoolClass.subjects[0]?.id, value: String(subjectId), defaultValue: schoolClass.subjects[0]?.id ?? "", onChange: (value) => { setSubjectId(value); setNotice(''); }, render: (value, onChange) => (<Select className={field} value={value} onChange={(event) => onChange(event.target.value)}>{schoolClass.subjects.map((s) => <option key={s.id} value={s.id}>{s.vietnameseName || s.name}</option>)}</Select>) }),defineToolbarFilter({ id:"term", label:"Học kỳ", width:260, value: String(termId), defaultValue: (terms.find((term) => term.status === "ACTIVE") ?? terms[0])?.id ?? "", onChange: (value) => { setTermId(value); setNotice(''); }, render: (value, onChange) => (<Select className={field} value={value} onChange={(event) => onChange(event.target.value)}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.status === 'COMPLETED' ? 'Chấm nốt' : t.status === 'LOCKED' ? 'Đã khóa' : t.status === 'ACTIVE' ? 'Đang diễn ra' : 'Sắp diễn ra'}</option>)}</Select>) })]} />
    {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p> : null}{notice ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-700">{notice}</p> : null}
    {loading ? <p role="status">Đang tải kết quả…</p> : null}
    {view && !view.book ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có bảng kết quả. Quản trị viên cần cấu hình sổ điểm cho môn và học kỳ trong lớp. Các nguồn điểm đang chờ sẽ được liên kết khi cấu hình xong.</p> : null}
    {filtered?.book ? <>
      {view?.term.status === 'COMPLETED' ? <p className="text-sm text-amber-700">Học kỳ đã kết thúc. Giáo viên được chấm và công bố nốt các bài cũ.</p> : null}
      {disabled ? <p className="text-sm text-slate-500">Chỉ xem kết quả trong phạm vi này.</p> : null}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-2">Học sinh</th><th className="p-2">Trung bình đã công bố</th><th className="p-2">Số bài có điểm</th></tr></thead><tbody>{filtered.students.map((s) => { const g = s.internalGroups?.find((g) => g.purpose === 'REGULAR'); return <tr key={s.id} className="border-t"><td className="p-2">{s.fullName}</td><td className="p-2">{g?.average === null || g?.average === undefined ? 'Chưa có điểm' : `${g.average.toFixed(1)}/10`}</td><td className="p-2">{g?.scoredCount ?? 0}</td></tr>; })}</tbody></table></div>
      <UnifiedGradeItems view={filtered} disabled={disabled} allowPlanning={Boolean((can("teaching.update") || can("academic.update")) && view?.term.status === "UPCOMING" && view.year?.status !== "COMPLETED" && view.schoolClass?.isActive !== false)} internal onChanged={(message) => { setNotice(message); setRefresh((v) => v + 1); }} onError={setError} />
    </> : null}
  </div>;
}
