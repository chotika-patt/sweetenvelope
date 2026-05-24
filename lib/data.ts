import { Person, Account } from '@/types';

export const PEOPLE: Person[] = [
  { id: 1,  name: 'น้องแป้ง',  emoji: '🌸', tag: '✨ คนน่ารัก' },
  { id: 2,  name: 'พี่ต้น',    emoji: '🌿', tag: '🎸 นักดนตรี' },
  { id: 3,  name: 'น้องมิ้ว',  emoji: '🐱', tag: '📚 หนอนหนังสือ' },
  { id: 4,  name: 'พี่แนน',    emoji: '🌙', tag: '🎨 ศิลปิน' },
  { id: 5,  name: 'น้องบอส',   emoji: '⭐', tag: '⚽ นักกีฬา' },
  { id: 6,  name: 'น้องพลอย',  emoji: '💎', tag: '🎭 นักแสดง' },
  { id: 7,  name: 'พี่เจม',    emoji: '🔥', tag: '💻 โปรแกรมเมอร์' },
  { id: 8,  name: 'น้องฟ้า',   emoji: '☁️', tag: '🌈 ครีเอทีฟ' },
  { id: 9,  name: 'พี่กาย',    emoji: '🎯', tag: '📸 ช่างภาพ' },
  { id: 10, name: 'น้องมาย',   emoji: '🍀', tag: '🎵 นักร้อง' },
  { id: 11, name: 'พี่บิ๊ก',   emoji: '🦁', tag: '🏋️ ฟิตเนส' },
  { id: 12, name: 'น้องนิว',   emoji: '🌺', tag: '✈️ นักเดินทาง' },
];

// ⚠️ production: ย้าย password ไปเก็บ hash ใน DB หรือ NextAuth
export const ACCOUNTS: Account[] = [
  { username: 'user01', password: 'pass01', personId: 1 },
  { username: 'user02', password: 'pass02', personId: 2 },
  { username: 'user03', password: 'pass03', personId: 3 },
  { username: 'user04', password: 'pass04', personId: 4 },
  { username: 'user05', password: 'pass05', personId: 5 },
];
