import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FaArrowLeft,
  FaAward,
  FaBookOpen,
  FaCheckCircle,
  FaClipboardCheck,
  FaCode,
  FaLeaf,
  FaLock,
  FaPrint,
  FaShieldAlt,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import Navbar from '../components/common/Navbar';
import { useAuth } from '../hooks/useAuth';
import keradionLogo from '../assets/keradion-logo.png';
import { studentApi } from '../services/studentApi';
import { buildCourseCertificateStatus, createCertificateReference } from '../utils/courseCertificates';
import manual from '../assets/Keradion_User_Manual.pdf';

const normalizeCourse = (course, fallbackId) => {
  const id =
    course?.id ??
    course?._id ??
    course?.code ??
    course?.courseCode ??
    course?.course_code ??
    course?.courseId ??
    course?.course_id ??
    course?.slug ??
    fallbackId;

  return {
    ...course,
    id: id != null ? String(id) : undefined,
    title: course?.title ?? course?.name ?? '',
    description: course?.description ?? course?.summary ?? '',
  };
};

const formatCertificateDate = (value) => {
  if (!value) return 'Pending completion';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending completion';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const CertificateRule = ({ done, text }) => (
  <div className="flex items-start gap-3 rounded-xl border border-[#dbc79a] bg-white/75 px-4 py-3">
    <span className={`mt-0.5 ${done ? 'text-emerald-700' : 'text-amber-700'}`}>
      <FaCheckCircle aria-hidden="true" />
    </span>
    <p className="text-sm text-[#3b352a]">{text}</p>
  </div>
);

const CertificateDecor = () => (
  <div className="flex items-center justify-center gap-5 text-[#9b7b2a]">
    <FaLeaf aria-hidden="true" />
    <FaCode aria-hidden="true" />
    <FaLeaf aria-hidden="true" />
    <FaCode aria-hidden="true" />
    <FaLeaf aria-hidden="true" />
  </div>
);

const CourseCertificate = () => {
  const { courseId } = useParams();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [certificateStatus, setCertificateStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [courseData, lessonsData, quizzesData, resultsData] = await Promise.all([
          studentApi.getCourseById(courseId),
          studentApi.getLessonsByCourse(courseId),
          studentApi.getQuizzesByCourse(courseId),
          studentApi.getMyResults().catch(() => []),
        ]);

        if (!active) return;

        setCourse(courseData ? normalizeCourse(courseData, courseId) : null);
        setCertificateStatus(
          buildCourseCertificateStatus({
            courseId,
            lessons: Array.isArray(lessonsData) ? lessonsData : [],
            quizzes: Array.isArray(quizzesData) ? quizzesData : [],
            results: Array.isArray(resultsData) ? resultsData : [],
          }),
        );
      } catch (err) {
        if (!active) return;
        setCourse(null);
        setCertificateStatus(null);
        toast.error(err?.response?.data?.message || err?.message || 'Failed to load certificate');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (courseId) {
      load();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [courseId]);

  const studentName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name;
    const emailName = user?.email?.split('@')?.[0]?.trim();
    return emailName || 'Student Name';
  }, [user]);

  const referenceNumber = useMemo(
    () =>
      createCertificateReference({
        courseId,
        userId: user?.id ?? user?._id ?? user?.email ?? studentName,
        completedAt: certificateStatus?.completedAt,
      }),
    [certificateStatus?.completedAt, courseId, studentName, user],
  );

  const handlePrint = () => {
    if (!certificateStatus?.eligible) return;
    window.print();
  };

  const missingLessonNames = certificateStatus?.missingLessons?.map((lesson) => lesson.title || lesson.id).filter(Boolean) ?? [];
  const missingQuizNames =
    certificateStatus?.missingQuizLessons?.map((lesson) => lesson?.title || lesson?.id).filter(Boolean) ?? [];
  const completionDate = formatCertificateDate(certificateStatus?.completedAt);

  return (
    <div className="certificate-page min-h-screen bg-[#f5efe2]">
      <Navbar />

      <main className="certificate-print-shell mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="certificate-actions flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to={courseId ? `/courses/${courseId}/lessons` : '/courses'} className="inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-800">
            <FaArrowLeft aria-hidden="true" /> Back to lessons
          </Link>

          {certificateStatus?.eligible ? (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0f646c] bg-[#0f646c] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0b5157]"
            >
              <FaPrint aria-hidden="true" /> Print or Save PDF
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-8 rounded-3xl border border-[#dbc79a] bg-white/90 p-10 shadow-sm">
            <p className="text-lg font-bold text-[#17353f]">Loading certificate...</p>
            <p className="mt-2 text-sm text-[#5b564c]">Checking course completion and quiz results.</p>
          </div>
        ) : !course ? (
          <div className="mt-8 rounded-3xl border border-[#dbc79a] bg-white/90 p-10 shadow-sm">
            <p className="text-lg font-bold text-[#17353f]">Course not found</p>
            <p className="mt-2 text-sm text-[#5b564c]">The course certificate could not be loaded.</p>
          </div>
        ) : !certificateStatus?.eligible ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
            <section className="rounded-[28px] border border-[#dbc79a] bg-white/90 p-8 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3ead0] text-[#9b7b2a]">
                  <FaLock size={22} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#9b7b2a]">Certificate Locked</p>
                  <h1 className="mt-2 text-3xl font-black text-[#17353f]">{course.title}</h1>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5b564c]">
                    This certificate unlocks after every lesson is marked complete and every lesson quiz for this course is passed.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <CertificateRule
                  done={certificateStatus.lessonsComplete}
                  text={`${certificateStatus.completedLessons} of ${certificateStatus.totalLessons} lessons completed`}
                />
                <CertificateRule
                  done={certificateStatus.quizzesComplete}
                  text={
                    `${certificateStatus.passedQuizCount} of ${certificateStatus.requiredQuizCount} required quizzes passed`
                  }
                />
              </div>

              {missingLessonNames.length ? (
                <div className="mt-8 rounded-2xl border border-[#eadcb7] bg-[#f9f4e6] p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8d6d1f]">Lessons still pending</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#4e493f]">{missingLessonNames.join(', ')}</p>
                </div>
              ) : null}

              {missingQuizNames.length ? (
                <div className="mt-4 rounded-2xl border border-[#eadcb7] bg-[#f9f4e6] p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8d6d1f]">Quizzes still to pass</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#4e493f]">{missingQuizNames.join(', ')}</p>
                </div>
              ) : null}
            </section>

            <aside className="rounded-[28px] border border-[#dbc79a] bg-[#133d42] p-8 text-white shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#d7c27e]">How to unlock it</p>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold">1. Complete every lesson</p>
                  <p className="mt-2 text-sm text-white/75">Open the course lessons and mark each lesson as complete once you finish it.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold">2. Pass each lesson quiz</p>
                  <p className="mt-2 text-sm text-white/75">Your best passed attempt is used, so you can retake quizzes until you succeed.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold">3. Return here to print the certificate</p>
                  <p className="mt-2 text-sm text-white/75">Once the course is complete, this page turns into the printable certificate automatically.</p>
                </div>
              </div>

              <div className="mt-8 grid gap-3">
                <Link
                  to={`/courses/${courseId}/lessons`}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d7c27e] px-5 py-3 font-semibold text-[#17353f] transition-colors hover:bg-[#e4d39a]"
                >
                  <FaBookOpen aria-hidden="true" /> Continue course
                </Link>
                <Link
                  to="/results"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <FaClipboardCheck aria-hidden="true" /> Review quiz results
                </Link>
              </div>
            </aside>
          </div>
        ) : (
          <>
            <section className="certificate-shell mt-8 rounded-[36px] border border-[#d2bc88] bg-[#f9f3e3] p-4 shadow-[0_24px_60px_rgba(83,66,19,0.18)]">
              <div className="certificate-frame relative overflow-hidden rounded-[30px] border-[3px] border-[#0f646c] bg-[linear-gradient(135deg,rgba(255,253,247,0.98),rgba(244,234,206,0.9))] px-6 py-8 sm:px-10 sm:py-10 lg:px-14">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,100,108,0.08),transparent_42%),linear-gradient(135deg,rgba(201,167,77,0.12),transparent_50%)]" />
                <img
                  src={keradionLogo}
                  alt=""
                  aria-hidden="true"
                  className="certificate-watermark pointer-events-none absolute left-1/2 top-1/2 w-[44%] max-w-[320px] -translate-x-1/2 -translate-y-1/2 opacity-[0.08] saturate-0"
                />

                <div className="certificate-content relative z-10">
                  <div className="certificate-decor-frame rounded-[22px] border border-[#c7aa5c] px-4 py-3">
                    <CertificateDecor />
                  </div>

                  <div className="certificate-hero mt-8 text-center">
                    <img src={keradionLogo} alt="Keradion" className="certificate-logo mx-auto h-20 w-auto object-contain" />
                  
                    <h1
                      className="certificate-title mt-6 text-4xl font-bold uppercase tracking-[0.12em] text-[#132b35] sm:text-5xl lg:text-6xl"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      Certificate of Completion
                    </h1>
                    <p className="mt-5 text-lg text-[#4c4639]">This certifies that</p>
                    <p
                      className="certificate-student-name mt-4 text-3xl font-semibold uppercase tracking-widest text-[#111827] sm:text-4xl lg:text-5xl"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {studentName}
                    </p>
                    <p className="certificate-description mx-auto mt-6 max-w-4xl text-base leading-relaxed text-[#403a2e] sm:text-lg">
                      has successfully completed the self-paced course
                    </p>
                    <p
                      className="certificate-course-name mx-auto mt-3 max-w-4xl text-2xl font-semibold text-[#17353f] sm:text-3xl lg:text-4xl"
                      style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                    >
                      {course.title}
                    </p>
                    <p className="certificate-description mx-auto mt-6 max-w-4xl text-sm leading-relaxed text-[#4a463e] sm:text-base">
                      All lessons, guided practice, and required quizzes have been finalized on <span className="font-semibold text-[#17353f]">{completionDate}</span>.
                      Presented by Keradion Learning Systems.
                    </p>
                  </div>

                  <div className="certificate-stats mt-10 grid gap-4 text-center sm:grid-cols-3">
                    <div className="certificate-stat-card rounded-2xl border border-[#dac596] bg-white/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d6d1f]">Lessons</p>
                      <p className="mt-2 text-2xl font-black text-[#17353f]">{certificateStatus.totalLessons}</p>
                    </div>
                    <div className="certificate-stat-card rounded-2xl border border-[#dac596] bg-white/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d6d1f]">Quizzes Passed</p>
                      <p className="mt-2 text-2xl font-black text-[#17353f]">{certificateStatus.passedQuizCount}</p>
                    </div>
                    <div className="certificate-stat-card rounded-2xl border border-[#dac596] bg-white/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d6d1f]">Certificate ID</p>
                      <p className="mt-2 text-sm font-black tracking-[0.18em] text-[#17353f]">{referenceNumber}</p>
                    </div>
                  </div>

                  <div className="certificate-signature-row mt-10 flex flex-col gap-8 border-y border-[#c7aa5c] py-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="certificate-admin-signature text-3xl text-[#8d6d1f]" style={{ fontFamily: '"Great Vibes", cursive' }}>
                        Keradion Administration
                      </p>
                      <div className="mt-2 h-px w-56 bg-[#8d6d1f]" />
                      <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#17353f]">Administrator</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8d6d1f]">Verified Achievement</p>
                      <div className="certificate-verify-pill mt-2 inline-flex items-center gap-2 rounded-full border border-[#c7aa5c] bg-white/75 px-4 py-2 text-sm font-semibold text-[#17353f]">
                        <FaShieldAlt aria-hidden="true" />
                        <span>Issued by Keradion LMS</span>
                      </div>
                    </div>
                  </div>

                  <div className="certificate-decor-frame mt-6 rounded-[22px] border border-[#c7aa5c] px-4 py-3">
                    <CertificateDecor />
                  </div>
                </div>

                <div className="certificate-seal absolute bottom-5 right-5 z-10 flex h-28 w-28 items-center justify-center rounded-full border-[6px] border-[#cfb063] bg-[radial-gradient(circle_at_30%_30%,#1b695f,#0f463f)] p-3 shadow-[0_16px_28px_rgba(15,57,53,0.28)] sm:bottom-8 sm:right-8 sm:h-36 sm:w-36">
                  <div className="absolute inset-2 rounded-full border border-[#e6d39a]/60" />
                  <div className="absolute inset-0 rounded-full [clip-path:polygon(50%_0%,61%_11%,75%_4%,81%_18%,96%_18%,89%_32%,100%_50%,89%_68%,96%_82%,81%_82%,75%_96%,61%_89%,50%_100%,39%_89%,25%_96%,19%_82%,4%_82%,11%_68%,0%_50%,11%_32%,4%_18%,19%_18%,25%_4%,39%_11%)] bg-[#cfb063]/25" />
                  <div className="relative z-10 text-center">
                    <img src={keradionLogo} alt="" aria-hidden="true" className="mx-auto h-10 w-auto object-contain brightness-110 saturate-0 invert-[0.08] sepia-[0.9] hue-rotate-[5deg]" />
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#efe2b8]">Verified</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="certificate-actions mt-6 flex flex-col gap-4 rounded-[26px] border border-[#dbc79a] bg-white/85 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8d6d1f]">Ready to export</p>
                <p className="mt-1 text-sm text-[#5b564c]">Use the print dialog and choose &quot;Save as PDF&quot; if you want a downloadable file.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0f646c] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#0b5157]"
                >
                  <FaAward aria-hidden="true" /> Export certificate
                </button>
                <Link
                  to={`/courses/${courseId}/lessons`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0f646c] px-5 py-3 font-semibold text-[#0f646c] transition-colors hover:bg-[#eaf5f6]"
                >
                  <FaBookOpen aria-hidden="true" /> Back to course
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="certificate-actions border-t border-[#e0d5b2] bg-white/70 py-8">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="text-sm text-[#6a6557]">(c) {new Date().getFullYear()} Keradion. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm">
              <a href={manual} className="text-gray-600 hover:text-primary-600 transition-colors" target="_blank" rel="noopener noreferrer">
                Help
              </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CourseCertificate;
