import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Landing from '../Landing';

describe('landing page', () => {
  it('offers real workspace and repository destinations and labels example data', () => {
    render(<Landing />);
    expect(screen.getByRole('heading', { name: /Less tab switching/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /open workspace/i })[0]).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: /view on github/i })).toHaveAttribute('href', 'https://github.com/Nour-yahyaoui/github-manager');
    expect(screen.getByText('EXAMPLE DATA')).toBeInTheDocument();
  });
});
