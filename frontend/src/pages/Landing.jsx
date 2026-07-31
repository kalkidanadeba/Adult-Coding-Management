import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  FaBullseye,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaDatabase,
  FaEnvelope,
  FaGitAlt,
  FaHtml5,
  FaJs,
  FaLaptopCode,
  FaMapMarkerAlt,
  FaNodeJs,
  FaPhoneAlt,
  FaReact,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import keradionLogo from '../assets/keradion-logo.png';
import api from '../services/api';
import { validateEmail } from '../utils/validators';
import aboutImage from '../assets/background7.png';
import background1 from '../assets/background9.jpg';
import background2 from '../assets/back11.jpg';
import background3 from '../assets/back13.png';
import manual from '../assets/Keradion_User_Manual.pdf';
import SiteFooter from '../components/common/SiteFooter';

const Landing = () => {
  const courses = [
    {
      title: 'HTML & CSS',
      description: 'Build responsive layouts and modern UI using semantic markup and styling best practices.',
      Icon: FaHtml5,
    },
    {
      title: 'JavaScript',
      description: 'Learn core programming fundamentals, ES6+ syntax, and how to write clean, reusable code.',
      Icon: FaJs,
    },
    {
      title: 'React',
      description: 'Create component-based user interfaces, manage state, and build real frontend projects.',
      Icon: FaReact,
    },
    {
      title: 'Node & Express',
      description: 'Build REST APIs, handle authentication, and connect your applications to a backend.',
      Icon: FaNodeJs,
    },
    {
      title: 'Databases',
      description: 'Understand data modeling and work with SQL/NoSQL databases to store and retrieve data.',
      Icon: FaDatabase,
    },
    {
      title: 'Git & GitHub',
      description: 'Use version control confidently, collaborate with others, and manage project history.',
      Icon: FaGitAlt,
    },
  ];
  
  const heroSlides = [
    {
      id: 1,
      image: background1,
      title: 'Build real-world coding skills with a structured learning path.',
      description: 'Learn through focused lessons, practice with interactive exercises, and track your progress all in one place designed to keep you consistent.',
    },
    {
      id: 2,
      image: background2,
      title: 'Grow with Keradion through guided lessons and practical learning.',
      description: 'Explore our website courses, track your progress, and turn each lesson into real-world confidence with clear, step-by-step support.',
    },
    {
      id: 3,
      image: background3,
      title: '',
      description: '',
    },
  ];

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [contactErrors, setContactErrors] = useState({});
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    const startAutoPlay = () => {
      const id = window.setInterval(() => {
        setActiveSlide((prev) => (prev + 1) % heroSlides.length);
      }, 8000);
      setIntervalId(id);
    };

    startAutoPlay();

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [heroSlides.length]);

  const goToSlide = (direction) => {
    // Clear the current interval
    if (intervalId) window.clearInterval(intervalId);

    // Update the slide
    setActiveSlide((prev) => (prev + direction + heroSlides.length) % heroSlides.length);

    // Restart the auto-play after user interaction
    const id = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 8000);
    setIntervalId(id);
  };

  const goToSpecificSlide = (index) => {
    // Clear the current interval
    if (intervalId) window.clearInterval(intervalId);

    // Update the slide
    setActiveSlide(index);

    // Restart the auto-play after user interaction
    const id = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 8000);
    setIntervalId(id);
  };

  const scrollToHero = (e) => {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Function to scroll to specific sections
  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm((prev) => ({ ...prev, [name]: value }));
    if (contactErrors[name]) {
      setContactErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateContactForm = () => {
    const nextErrors = {};

    if (!contactForm.name.trim()) {
      nextErrors.name = 'Name is required';
    }

    if (!contactForm.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!validateEmail(contactForm.email)) {
      nextErrors.email = 'Please enter a valid email';
    }

    const trimmedMessage = contactForm.message.trim();
    if (!trimmedMessage) {
      nextErrors.message = 'Message is required';
    } else if (trimmedMessage.length < 2) {
      nextErrors.message = 'Message must be at least 2 characters';
    } else if (trimmedMessage.length > 2000) {
      nextErrors.message = 'Message must be 2000 characters or less';
    }

    setContactErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (contactSubmitting) return;

    if (!validateContactForm()) return;

    setContactSubmitting(true);

    try {
      const payload = {
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        message: contactForm.message.trim(),
      };

      const response = await api.post('/contact', payload);
      const data = response?.data ?? {};

      if (data?.success === false) {
        throw new Error(data?.message || 'Failed to send message');
      }

      toast.success(data?.message || 'Message sent successfully!');
      setContactForm({ name: '', email: '', message: '' });
      setContactErrors({});
    } catch (err) {
      const status = err?.response?.status;
      const responseData = err?.response?.data;

      const nextFieldErrors = {};
      if (responseData && typeof responseData === 'object') {
        const candidateErrors = responseData?.errors;

        if (Array.isArray(candidateErrors)) {
          for (const item of candidateErrors) {
            const key = item?.param || item?.path || item?.field;
            const msg = item?.msg || item?.message || item?.error;
            if (key && msg) nextFieldErrors[key] = msg;
          }
        } else if (candidateErrors && typeof candidateErrors === 'object') {
          for (const [key, value] of Object.entries(candidateErrors)) {
            if (typeof value === 'string') {
              nextFieldErrors[key] = value;
            } else if (value && typeof value === 'object') {
              const msg = value?.msg || value?.message || value?.error;
              if (typeof msg === 'string') nextFieldErrors[key] = msg;
            }
          }
        }
      }

      if (Object.keys(nextFieldErrors).length) {
        setContactErrors((prev) => ({ ...prev, ...nextFieldErrors }));
      }

      const message =
        (responseData && typeof responseData === 'object' && (responseData.message || responseData.error || responseData.msg)) ||
        (typeof responseData === 'string' ? responseData : null) ||
        (status ? `Request failed with status code ${status}` : null) ||
        err?.message ||
        'Failed to send message. Please try again.';
      toast.error(message, {
        style: {
          background: '#ef4444',
          color: '#fff',
        },
      });
    } finally {
      setContactSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 via-white to-primary-50 flex flex-col">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="Keradion home">
            <img
              src={keradionLogo}
              alt="Keradion logo"
              className="h-16 sm:h-20 w-auto max-w-[320px] object-contain"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a 
              href="#home" 
              onClick={scrollToHero}
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              Home
            </a>
            <a 
              href="#about" 
              onClick={(e) => scrollToSection(e, 'about')}
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              About
            </a>
            <a 
              href="#courses" 
              onClick={(e) => scrollToSection(e, 'courses')}
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              Courses
            </a>
            <a 
              href="#contact" 
              onClick={(e) => scrollToSection(e, 'contact')}
              className="text-gray-600 hover:text-primary-600 transition-colors"
            >
              Contact
            </a>
            <a href={manual} className="text-gray-600 hover:text-primary-600 transition-colors" target="_blank" rel="noopener noreferrer">
                Help
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              Login
            </Link>
            <Link
              to="/register"
              className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section id="home" className="relative overflow-hidden min-h-160">
          <div className="absolute inset-0">
            {heroSlides.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-700 ${index === activeSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                style={{ backgroundImage: `url(${slide.image})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
              />
            ))}
            <div className="absolute inset-0 pointer-events-none z-20">
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-200 rounded-full opacity-10 blur-2xl" />
              <div className="absolute -bottom-44 -left-44 w-96 h-96 bg-primary-300 rounded-full opacity-10 blur-2xl" />
            </div>
          </div>

          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goToSlide(-1)}
            className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/70 bg-white/70 p-3 text-gray-800 shadow-lg backdrop-blur transition hover:bg-white"
          >
            <FaChevronLeft />
          </button>

          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goToSlide(1)}
            className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full border border-white/70 bg-white/70 p-3 text-gray-800 shadow-lg backdrop-blur transition hover:bg-white"
          >
            <FaChevronRight />
          </button>

          <div className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-28">
            <Motion.div
              key={activeSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="max-w-lg text-left"
            >
              {activeSlide === 2 ? null : (
                <>
                  <Motion.h1 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
                    className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-gray-900"
                  >
                    {activeSlide === 0 ? (
                      <>
                        Build real-world coding 
                        skills with a{' '}
                        <span className="text-transparent bg-clip-text bg-linear-to-r from-primary-600 to-primary-800">
                          structured learning path.
                        </span>
                      </>
                    ) : (
                      <>
                        Grow with{' '}
                        <span className="text-transparent bg-clip-text bg-linear-to-r from-green-600 to-emerald-700">
                          Keradion
                        </span>{' '}
                        through guided lessons and practical learning.
                      </>
                    )}
                  </Motion.h1>

                  <Motion.p 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
                    className={`mt-6 max-w-sm text-gray-700 ${activeSlide === 1 ? 'text-base sm:text-lg' : 'text-lg sm:text-lg'}`}
                  >
                    {heroSlides[activeSlide].description}
                  </Motion.p>

                  <Motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.5, ease: 'easeOut' }}
                    className="mt-10 flex flex-col sm:flex-row items-center gap-4"
                  >
                    <Link
                      to="/register"
                      className="bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors shadow-sm"
                    >
                      Get Started
                    </Link>

                    <Link
                      to="/courses"
                      className="border border-gray-300 bg-white/70 px-6 py-3 rounded-xl font-semibold text-gray-700 hover:border-primary-500 hover:text-primary-600 transition-colors"
                    >
                      Explore Courses
                    </Link>
                  </Motion.div>
                </>
              )}
            </Motion.div>

            <Motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-8 flex items-center gap-2"
            >
              {heroSlides.map((slide, index) => (
                <Motion.button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => goToSpecificSlide(index)}
                  animate={{ scale: index === activeSlide ? 1 : 0.8, opacity: index === activeSlide ? 1 : 0.6 }}
                  transition={{ duration: 0.3 }}
                  className={`h-2.5 w-2.5 rounded-full transition ${index === activeSlide ? 'bg-primary-600' : 'bg-white/80'}`}
                />
              ))}
            </Motion.div>
          </div>
        </section>

        <section id="about" className="scroll-mt-24 py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div className="mt-8 lg:mt-0 flex justify-center lg:justify-start">
                <img
                  src={aboutImage}
                  alt="Team collaboration illustration"
                  className="w-full max-w-md lg:max-w-lg object-contain"
                />
              </div>

              <div className="max-w-3xl">
                <h2 className="text-3xl font-extrabold text-primary-700">About Keradion</h2>
                <p className="mt-4 text-gray-600 text-lg leading-relaxed text-justify">
                  Keradion is a modern platform designed to make learning programming simple, flexible, 
                  and effective. It transforms traditional live coding sessions into a self-paced learning 
                  experience where users can build real coding skills anytime and from anywhere. The platform 
                  provides structured courses, interactive quizzes, and progress tracking to help learners stay
                  engaged and improve step by step. Keradion is committed to creating an accessible and practical
                  learning environment focused on real-world skills, empowering users to grow confidently at 
                  their own pace.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="courses" className="scroll-mt-24 py-20 bg-white border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-extrabold text-gray-900">Courses We Give</h2>
              <p className="mt-4 text-gray-600 text-lg leading-relaxed text-justify">
                We provide guided learning tracks across the core tools and technologies below, designed to help you build
                practical skills step by step.
              </p>
            </div>

            <Motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                hidden: {},
                show: {
                  transition: { staggerChildren: 0.08, delayChildren: 0.12 },
                },
              }}
              className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {courses.map((course) => (
                <Motion.div
                  key={course.title}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
                  }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                  className="rounded-2xl border border-gray-200 p-6 bg-gray-50 transition-all duration-300 hover:bg-primary-50 hover:border-primary-300 hover:shadow-md hover:-translate-y-1"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
                      <course.Icon size={22} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900">{course.title}</h3>
                      <p className="mt-2 text-sm text-gray-600 leading-relaxed text-justify">{course.description}</p>
                    </div>
                  </div>
                </Motion.div>
              ))}
            </Motion.div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900">Contact</h2>
                <p className="mt-4 text-gray-600 text-lg">Have questions or feedback? Reach out and we'll get back to you.</p>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <FaEnvelope className="text-primary-600" />
                    <span>support@keradion.com</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <FaPhoneAlt className="text-primary-600" />
                    <span>+251 000 000 000</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <FaMapMarkerAlt className="text-primary-600" />
                    <span>Addis Ababa, Ethiopia</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <h3 className="text-xl font-bold text-gray-900">Send a message</h3>
                <form className="mt-6 space-y-4" onSubmit={handleContactSubmit}>
                  <div>
                    <label className="input-label" htmlFor="contactName">
                      Name
                    </label>
                    <input
                      id="contactName"
                      name="name"
                      className={`input-field ${contactErrors.name ? 'border-red-500 focus:ring-red-200' : ''}`}
                      placeholder="Your name"
                      value={contactForm.name}
                      onChange={handleContactChange}
                      disabled={contactSubmitting}
                      required
                    />
                    {contactErrors.name ? <p className="input-error">{contactErrors.name}</p> : null}
                  </div>
                  <div>
                    <label className="input-label" htmlFor="contactEmail">
                      Email
                    </label>
                    <input
                      id="contactEmail"
                      name="email"
                      className={`input-field ${contactErrors.email ? 'border-red-500 focus:ring-red-200' : ''}`}
                      type="email"
                      placeholder="you@example.com"
                      value={contactForm.email}
                      onChange={handleContactChange}
                      disabled={contactSubmitting}
                      required
                    />
                    {contactErrors.email ? <p className="input-error">{contactErrors.email}</p> : null}
                  </div>
                  <div>
                    <label className="input-label" htmlFor="contactMessage">
                      Message
                    </label>
                    <textarea
                      id="contactMessage"
                      name="message"
                      className={`input-field ${contactErrors.message ? 'border-red-500 focus:ring-red-200' : ''}`}
                      rows={4}
                      placeholder="Write your message..."
                      minLength={2}
                      maxLength={2000}
                      value={contactForm.message}
                      onChange={handleContactChange}
                      disabled={contactSubmitting}
                      required
                    />
                    {contactErrors.message ? <p className="input-error">{contactErrors.message}</p> : null}
                  </div>
                  <button
                    type="submit"
                    disabled={contactSubmitting}
                    className={`inline-flex items-center justify-center bg-primary-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors w-full ${
                      contactSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary-600'
                    }`}
                  >
                    {contactSubmitting ? 'Sending...' : 'Submit'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
};

export default Landing;
