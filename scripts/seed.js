require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Course = require('../src/models/Course');
const Event = require('../src/models/Event');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_platform');
  console.log('Connected to MongoDB for seeding...');

  await Promise.all([User.deleteMany(), Course.deleteMany(), Event.deleteMany()]);

  const instructor = await User.create({
    name: 'Dr. Priya Sharma',
    email: 'instructor@lms.com',
    password: 'password123',
    role: 'instructor',
  });

  const student = await User.create({
    name: 'Rahul Verma',
    email: 'student@lms.com',
    password: 'password123',
    role: 'student',
  });

  await User.create({
    name: 'Admin User',
    email: 'admin@lms.com',
    password: 'password123',
    role: 'admin',
  });

  const courses = await Course.insertMany([
    {
      title: 'Full Stack Web Development',
      description: 'Master HTML, CSS, JavaScript, Node.js, Express, and MongoDB. Build production-ready applications.',
      instructor: instructor._id,
      category: 'Development',
      price: 2999,
      level: 'intermediate',
      duration: '12 weeks',
      lessons: [
        { title: 'Introduction to Web', content: 'Overview of the web ecosystem', duration: '45 min', order: 1 },
        { title: 'Node.js Fundamentals', content: 'Event loop, modules, npm', duration: '60 min', order: 2 },
        { title: 'Express & REST APIs', content: 'Routing, middleware, error handling', duration: '90 min', order: 3 },
      ],
      rating: 4.7,
    },
    {
      title: 'Data Structures & Algorithms',
      description: 'Ace technical interviews with comprehensive DSA training and problem-solving strategies.',
      instructor: instructor._id,
      category: 'Computer Science',
      price: 1999,
      level: 'advanced',
      duration: '10 weeks',
      lessons: [
        { title: 'Arrays & Strings', content: 'Two pointers, sliding window', duration: '75 min', order: 1 },
        { title: 'Trees & Graphs', content: 'BFS, DFS, shortest paths', duration: '120 min', order: 2 },
      ],
      rating: 4.9,
    },
    {
      title: 'UI/UX Design Fundamentals',
      description: 'Learn design thinking, wireframing, prototyping, and creating delightful user experiences.',
      instructor: instructor._id,
      category: 'Design',
      price: 1499,
      level: 'beginner',
      duration: '6 weeks',
      rating: 4.5,
    },
    {
      title: 'Machine Learning with Python',
      description: 'From linear regression to neural networks. Hands-on projects with scikit-learn and TensorFlow.',
      instructor: instructor._id,
      category: 'AI/ML',
      price: 3999,
      level: 'intermediate',
      duration: '14 weeks',
      rating: 4.8,
    },
  ]);

  const now = new Date();
  await Event.insertMany([
    {
      title: 'React 19 Masterclass Live',
      description: 'Live webinar covering React 19 features, Server Components, and performance optimization.',
      organizer: instructor._id,
      eventType: 'webinar',
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      venue: 'Online',
      meetingLink: 'https://meet.example.com/react-masterclass',
      price: 499,
      capacity: 200,
      tags: ['react', 'frontend', 'webinar'],
    },
    {
      title: 'MongoDB Atlas Workshop',
      description: 'Hands-on workshop: schema design, aggregation pipelines, and production deployment on Atlas.',
      organizer: instructor._id,
      eventType: 'workshop',
      startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      venue: 'Tech Hub, Bangalore',
      price: 999,
      capacity: 50,
      tags: ['mongodb', 'database', 'workshop'],
    },
    {
      title: 'Annual EdTech Conference 2024',
      description: 'Industry leaders discuss the future of online learning, AI tutors, and accessibility in education.',
      organizer: instructor._id,
      eventType: 'conference',
      startDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 32 * 24 * 60 * 60 * 1000),
      venue: 'Convention Center, Mumbai',
      price: 2499,
      capacity: 500,
      tags: ['edtech', 'conference', 'networking'],
    },
    {
      title: '48-Hour Code Sprint Hackathon',
      description: 'Build an innovative LMS feature in 48 hours. Prizes for top 3 teams. Free for students.',
      organizer: instructor._id,
      eventType: 'hackathon',
      startDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000),
      venue: 'Online + Hybrid',
      price: 0,
      capacity: 100,
      tags: ['hackathon', 'coding', 'prizes'],
    },
  ]);

  console.log('\n✅ Database seeded successfully!\n');
  console.log('Demo accounts:');
  console.log('  Instructor: instructor@lms.com / password123');
  console.log('  Student:    student@lms.com / password123');
  console.log('  Admin:      admin@lms.com / password123');
  console.log(`\n  ${courses.length} courses and 4 events created.\n`);

  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
