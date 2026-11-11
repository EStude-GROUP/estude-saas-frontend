import type { ReactNode } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

const benefits = [
  {
    icon: BookOpenCheck,
    title: 'Học tập tập trung',
    detail: 'Tài liệu, bài tập và tiến độ trong một không gian.',
  },
  {
    icon: UsersRound,
    title: 'Kết nối lớp học',
    detail: 'Trao đổi thuận tiện cùng giảng viên và bạn học.',
  },
  {
    icon: Sparkles,
    title: 'Theo sát mục tiêu',
    detail: 'Nắm rõ lịch học và những việc cần ưu tiên mỗi ngày.',
  },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background p-0 lg:p-5">
      <div className="mx-auto grid min-h-screen max-w-[1500px] overflow-hidden bg-white shadow-soft lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(420px,0.92fr)_minmax(540px,1.08fr)] lg:rounded-[32px]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#123f9c] via-[#165fce] to-[#2d8df5] px-10 py-9 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
          <div
            className="auth-grid absolute inset-0 opacity-50"
            aria-hidden="true"
          />
          <div
            className="absolute -right-24 -top-24 size-80 rounded-full bg-cyan-300/20 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-blue-950/35 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10">
            <BrandLogo inverse />
          </div>

          <div className="relative z-10 my-auto max-w-xl py-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-50 backdrop-blur-sm">
              <CheckCircle2
                className="size-4 text-cyan-200"
                aria-hidden="true"
              />
              Không gian học tập dành cho bạn
            </div>
            <h1 className="max-w-lg text-balance text-4xl font-extrabold leading-[1.12] tracking-[-0.045em] xl:text-[52px]">
              Mỗi ngày học tốt hơn, theo cách của bạn.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-blue-100 xl:text-lg">
              EStude giúp học sinh tổ chức việc học, kết nối lớp học và tiến
              gần hơn đến mục tiêu của mình.
            </p>

            <div className="mt-10 space-y-4">
              {benefits.map(({ icon: Icon, title, detail }) => (
                <div
                  key={title}
                  className="flex max-w-lg items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.09] p-4 backdrop-blur-sm transition-transform hover:translate-x-1"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 text-cyan-100">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-bold text-white">{title}</p>
                    <p className="mt-0.5 text-sm leading-5 text-blue-100">
                      {detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-sm text-blue-200">
            © {new Date().getFullYear()} EStude · Học tập để trưởng thành
          </p>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:min-h-0 lg:px-14 xl:px-24">
          <div className="absolute left-5 top-6 lg:hidden">
            <BrandLogo />
          </div>
          <div className="w-full max-w-[480px] pt-20 lg:pt-0">{children}</div>
        </section>
      </div>
    </main>
  );
}
