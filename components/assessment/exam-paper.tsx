/* eslint-disable @next/next/no-img-element */
import { answerKeyText, paperTotalPoints, type PaperPart, type PaperQuestion, type PaperVersion } from "@/lib/exam-paper";
import { formatPoints } from "@/lib/thpt";

export interface PaperMeta {
  title: string;
  subjectName: string;
  minutes: number;
}

const bubble = "inline-grid size-[18px] place-items-center rounded-full border border-slate-700 text-[9px] font-bold leading-none";

function QuestionBlock({ q, number }: { q: PaperQuestion; number: number }) {
  const showImage = q.imageEnabled && q.imageUrl;
  const longOptions = q.options.some((o) => o.text.length > 38);
  return (
    <div className="break-inside-avoid pb-3">
      {showImage ? (
        <>
          <p><b>Câu {number}.</b></p>
          <img src={q.imageUrl ?? ""} alt={`Nội dung câu ${number}`} className="mt-1 max-h-[420px] max-w-full" />
        </>
      ) : (
        <p className="whitespace-pre-line"><b>Câu {number}.</b> {q.content}</p>
      )}
      {q.type === "TRUE_FALSE_SET" ? (
        <ul className="mt-1 space-y-0.5 pl-4">
          {q.options.map((o) => <li key={o.id}>{o.label}) {o.text}</li>)}
        </ul>
      ) : q.options.length > 0 ? (
        <ul className={`mt-1 grid gap-x-6 gap-y-0.5 pl-4 ${longOptions ? "grid-cols-1" : "grid-cols-2"}`}>
          {q.options.map((o) => <li key={o.id}><b>{o.label}.</b> {o.text}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

function PartBlock({ part }: { part: PaperPart }) {
  return (
    <section className="mt-4">
      <h3 className="font-bold">{part.title}</h3>
      <p className="mb-2 italic">{part.instruction}</p>
      {part.questions.map((q, index) => <QuestionBlock key={q.id} q={q} number={index + 1} />)}
    </section>
  );
}

function AnswerSheet({ version, meta }: { version: PaperVersion; meta: PaperMeta }) {
  const one = version.parts.find((p) => p.part === 1);
  const two = version.parts.find((p) => p.part === 2);
  const three = version.parts.find((p) => p.part === 3);
  if (!one && !two && !three) return null;
  return (
    <section className="print-sheet break-after-page break-inside-avoid pt-2">
      <h2 className="text-center text-base font-bold uppercase">Phiếu trả lời — Mã đề {version.code}</h2>
      <p className="text-center text-xs">{meta.subjectName} · {meta.title}</p>
      <p className="mt-3">Họ, tên thí sinh: ................................................ Lớp: .............. Số báo danh: ..............</p>
      {one ? (
        <div className="mt-4">
          <p className="mb-1 font-bold">PHẦN I <span className="font-normal italic">(chọn một phương án, tô kín ô tròn)</span></p>
          <div className="grid grid-cols-4 gap-x-6 gap-y-1.5">
            {one.questions.map((q, index) => (
              <div key={q.id} className="flex items-center gap-1.5">
                <span className="w-6 text-right font-bold">{index + 1}</span>
                {q.options.map((o) => <span key={o.id} className={bubble}>{o.label}</span>)}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {two ? (
        <div className="mt-5">
          <p className="mb-1 font-bold">PHẦN II <span className="font-normal italic">(mỗi ý chọn Đúng hoặc Sai)</span></p>
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="border border-slate-700 p-1">Câu</th>
                {["a", "b", "c", "d"].map((x) => <th key={x} colSpan={2} className="border border-slate-700 p-1">Ý {x})</th>)}
              </tr>
              <tr>
                <th className="border border-slate-700 p-1" />
                {["a", "b", "c", "d"].flatMap((x) => [<th key={x + "d"} className="border border-slate-700 p-1">Đ</th>, <th key={x + "s"} className="border border-slate-700 p-1">S</th>])}
              </tr>
            </thead>
            <tbody>
              {two.questions.map((q, index) => (
                <tr key={q.id}>
                  <td className="border border-slate-700 p-1 font-bold">{index + 1}</td>
                  {["a", "b", "c", "d"].flatMap((x) => [0, 1].map((k) => <td key={x + k} className="border border-slate-700 p-1"><span className={bubble}>{k === 0 ? "Đ" : "S"}</span></td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {three ? (
        <div className="mt-5">
          <p className="mb-1 font-bold">PHẦN III <span className="font-normal italic">(điền số, mỗi ô một ký tự, tối đa 4 ô)</span></p>
          <div className="grid grid-cols-3 gap-x-6 gap-y-2">
            {three.questions.map((q, index) => (
              <div key={q.id} className="flex items-center gap-2">
                <span className="w-12 font-bold">Câu {index + 1}</span>
                <span className="flex gap-0.5">{[0, 1, 2, 3].map((k) => <span key={k} className="inline-block h-7 w-6 border border-slate-700" />)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AnswerKey({ version, meta }: { version: PaperVersion; meta: PaperMeta }) {
  const explained = version.parts.flatMap((part) => part.questions.map((q, index) => ({ part, q, number: index + 1 }))).filter((item) => item.q.explanation?.trim());
  return (
    <section className="print-key break-after-page pt-2">
      <h2 className="text-center text-base font-bold uppercase">Đáp án — Mã đề {version.code}</h2>
      <p className="text-center text-xs">{meta.subjectName} · {meta.title}</p>
      {version.parts.map((part) => (
        <div key={part.part} className="mt-3 break-inside-avoid">
          <p className="font-bold">{part.title}</p>
          {part.part === 1 ? (
            <p className="mt-1 grid grid-cols-6 gap-x-3 gap-y-0.5">
              {part.questions.map((q, i) => <span key={q.id}><b>{i + 1}.</b> {answerKeyText(q)}</span>)}
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {part.questions.map((q, i) => <li key={q.id}><b>Câu {i + 1}:</b> {answerKeyText(q)}</li>)}
            </ul>
          )}
          {part.part === 2 ? <p className="mt-1 text-xs italic">Thang điểm mỗi câu: đúng 1 ý được 10%, 2 ý 25%, 3 ý 50%, cả 4 ý 100% số điểm của câu.</p> : null}
        </div>
      ))}
      {explained.length ? (
        <div className="mt-4">
          <p className="font-bold">Hướng dẫn giải / gợi ý chấm</p>
          <ol className="mt-1 space-y-1.5">
            {explained.map(({ part, q, number }) => (
              <li key={q.id} className="break-inside-avoid whitespace-pre-line">
                <b>{part.part === 1 ? "I" : part.part === 2 ? "II" : part.part === 3 ? "III" : "IV"}.{number}</b> ({formatPoints(q.points)} đ) {q.explanation}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

export function ExamPaper({ versions, meta, showKey, showSheet }: { versions: PaperVersion[]; meta: PaperMeta; showKey: boolean; showSheet: boolean }) {
  return (
    <div className="print-paper mx-auto w-full max-w-[794px] bg-white p-10 font-serif text-[14px] leading-6 text-black shadow-card">
      {versions.map((version) => {
        const all = version.parts.flatMap((p) => p.questions);
        return (
          <div key={version.code}>
            <section className="break-after-page">
              <header className="grid grid-cols-[1fr_1.4fr] gap-4 border-b border-black pb-3 text-center">
                <div>
                  <p className="font-bold uppercase">Đề kiểm tra theo định dạng</p>
                  <p className="font-bold uppercase">thi tốt nghiệp THPT</p>
                  <p className="mt-1 text-xs italic">Đề có {all.length} câu · {formatPoints(paperTotalPoints(all))} điểm</p>
                </div>
                <div>
                  <p className="font-bold uppercase">{meta.title}</p>
                  <p className="font-bold">Môn: {meta.subjectName}</p>
                  <p className="italic">Thời gian làm bài: {meta.minutes} phút, không kể thời gian phát đề</p>
                </div>
              </header>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p>Họ, tên thí sinh: ................................................... Số báo danh: ..............</p>
                <p className="shrink-0 border border-black px-3 py-0.5 font-bold">Mã đề: {version.code}</p>
              </div>
              {version.parts.map((part) => <PartBlock key={part.part} part={part} />)}
              <p className="mt-6 text-center font-bold">------ HẾT ------</p>
              <p className="text-center text-xs italic">Thí sinh không được sử dụng tài liệu. Cán bộ coi kiểm tra không giải thích gì thêm.</p>
            </section>
            {showSheet ? <AnswerSheet version={version} meta={meta} /> : null}
            {showKey ? <AnswerKey version={version} meta={meta} /> : null}
          </div>
        );
      })}
    </div>
  );
}
