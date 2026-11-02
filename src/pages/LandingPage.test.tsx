import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LandingPage } from './LandingPage';

describe('public equestrian landing', () => {
  it('identifies the product with local horse imagery and keeps access links on real login', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chính xác trong từng sải bước.');
    const horse = screen.getByRole('img', { name: /Ngựa nâu/ });
    expect(horse).toHaveAttribute('src', '/assets/landing-horse.webp');
    expect(horse).toHaveAttribute('fetchpriority', 'high');
    const loginLinks = screen.getAllByRole('link').filter(link => link.getAttribute('href') === '/login');
    expect(loginLinks).toHaveLength(4);
    expect(screen.getByText(/không cho đăng ký công khai/)).toBeInTheDocument();
    expect(screen.queryByText(/152|Thunder Bolt|Storm ·/)).not.toBeInTheDocument();
    expect(screen.queryByText('Hình ảnh minh họa')).not.toBeInTheDocument();
  });

  it('keeps section links valid and describes all seven roles without role-test sign-in', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    for (const link of screen.getAllByRole('link')) {
      const target = link.getAttribute('href');
      if (target?.startsWith('#')) expect(document.getElementById(target.slice(1))).not.toBeNull();
      else expect(target).toBe('/login');
    }
    for (const role of ['Club Manager', 'Veterinarian', 'Head Trainer', 'Trainer', 'Groom', 'Work Rider', 'Horse Owner']) {
      expect(screen.getByRole('heading', { name: role })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
