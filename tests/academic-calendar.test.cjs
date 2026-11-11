require('./helpers/register-ui.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {courseSummary,termsForYear,termAction,courseCalendarFilters}=require('../lib/academic-calendar.ts');
const year={id:'now',status:'ACTIVE'};
const active={id:'a',academicYearId:'now',displayOrder:1,status:'ACTIVE',name:'Học kỳ 1',startsAt:'2026-08-01'};
const upcoming={id:'b',academicYearId:'now',displayOrder:2,status:'UPCOMING',name:'Học kỳ 2',startsAt:'2027-01-01'};
test('year selection excludes other years and deleted terms, preserving semester order',()=>{
 assert.deepEqual(termsForYear([upcoming,{...active,id:'old',academicYearId:'old'}, {...active,id:'deleted',deletedAt:'today'},active],'now'),[active,upcoming]);
});
test('only legal next lifecycle actions are offered and an active semester blocks the next',()=>{
 assert.equal(termAction(upcoming,year,[active,upcoming]).blocked,'Cần kết thúc Học kỳ 1 trước khi bắt đầu học kỳ này.');
 assert.equal(termAction(active,year,[active,upcoming]).target,'COMPLETED');
 assert.equal(termAction({...active,status:'COMPLETED'},year,[]).target,'LOCKED');
 assert.equal(termAction({...active,status:'LOCKED'},year,[]),null);
 assert.equal(termAction(active,{...year,status:'COMPLETED'},[]),null);
 assert.match(termAction(upcoming,{...year,status:'UPCOMING'},[]).blocked,/kích hoạt năm học/);
 assert.equal(termAction(upcoming,year,[{...active,status:'COMPLETED'},upcoming]).blocked,'');
});
test('overview deduplicates teachers and labels enrolments as course registrations',()=>{
 const c={primaryClassId:'one',activeStudentCount:30,status:'OPEN',activeTeachers:[{teacherId:'teacher'}]};
 assert.deepEqual(courseSummary([c,{...c,status:'CLOSED'},{...c,primaryClassId:'two',activeStudentCount:20,activeTeachers:[{teacherId:'teacher'},{teacherId:'other'}]}]),{courses:3,classes:2,teachers:2,enrollments:80,open:2});
});
test('course navigation retains year, term and class context and validates status',()=>{
 assert.deepEqual(courseCalendarFilters('?academicYearId=y&termId=t&classId=c&status=OPEN'),{yearId:'y',termId:'t',classId:'c',status:'OPEN'});
 assert.equal(courseCalendarFilters('?status=unexpected').status,'');
});
