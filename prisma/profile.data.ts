// Demo content only. Replace all personal details before submitting the assignment.
export const profileData = {
  name: 'Ваше имя',
  description:
    'Демонстрационная цифровая визитка backend-разработчика. Замените эти данные своими.',
  links: [
    {
      id: 'github',
      label: 'GitHub — замените ссылку',
      url: 'https://github.com/your-username',
      sortOrder: 0,
    },
  ],
  skills: [
    'TypeScript',
    'Node.js',
    'NestJS',
    'Prisma',
    'GraphQL',
    'Docker',
    'Git',
  ].map((name, sortOrder) => ({ id: `skill-${sortOrder}`, name, sortOrder })),
  experience: [
    {
      id: 'demo-job',
      company: 'Пример компании — замените',
      position: 'Backend-разработчик — пример',
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: null,
      achievements: ['Здесь укажите подтверждаемые результаты вашей работы.'],
    },
  ],
  projects: [
    {
      id: 'developer-card',
      name: 'Цифровая визитка — этот проект',
      url: 'https://github.com/your-username/developer-card',
      sortOrder: 0,
    },
  ],
};
