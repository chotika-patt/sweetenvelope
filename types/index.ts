export interface Person {
  id: number;
  name: string;
  emoji: string;
  tag: string;
  photo?: string;
}

export interface Account {
  username: string;
  password: string;
  personId: number;
}

export interface Letter {
  id: string;
  to: number;
  from: string;
  anon: boolean;
  body: string;
  date: string;
  read: boolean;
  sentByPersonId: number | null;
  createdAt: number;
}
