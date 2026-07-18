import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MomentsProvider, useMoments } from '../features/moments/context/MomentsContext';
import { LanguageProvider } from '../context/LanguageContext';
import { UserProvider } from '../context/UserContext';
import PostComposer from '../features/moments/components/PostComposer';
import MomentCard from '../features/moments/components/MomentCard';

import { FriendProvider } from '../context/FriendContext';

// Mock scrollIntoView as it is not implemented in JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const TestWrapper = ({ children }) => (
  <LanguageProvider>
    <UserProvider>
      <FriendProvider>
        <MomentsProvider>
          {children}
        </MomentsProvider>
      </FriendProvider>
    </UserProvider>
  </LanguageProvider>
);

const MomentsFeed = () => {
    const { posts } = useMoments();
    return (
        <div data-testid="feed">
            <div data-testid="posts-count">{posts.length}</div>
            {posts.map(post => (
                <MomentCard key={post.id} post={post} />
            ))}
        </div>
    );
};

describe('User Simulation: Moments Posting and Liking', () => {
  it('should allow a user to open the composer, type a message, post it, and then like it', async () => {
    render(
      <TestWrapper>
        <MomentsFeed />
        <PostComposer isOpen={true} onClose={() => {}} />
      </TestWrapper>
    );

    // 1. Check if composer is open
    expect(screen.getByPlaceholderText(/有什么想分享的|What's on your mind/)).toBeInTheDocument();

    // 2. Type a message
    const textarea = screen.getByPlaceholderText(/有什么想分享的|What's on your mind/);
    fireEvent.change(textarea, { target: { value: 'Simulation: Real-user operation test!' } });

    // 3. Click the post button
    const postButton = screen.getByRole('button', { name: /发布|Post/i });
    fireEvent.click(postButton);

    // 4. Verify the post appears in the feed
    await waitFor(() => {
      expect(screen.getByText('Simulation: Real-user operation test!')).toBeInTheDocument();
    }, { timeout: 5000 });

    // 5. Simulate a "Like" interaction on the new post
    const newPost = screen.getByText('Simulation: Real-user operation test!').closest('[data-moment-card]');
    const likeButton = within(newPost).getByRole('button', { name: /点赞|Like/i });
    fireEvent.click(likeButton);

    // 6. Verify the like state is reflected
    // MomentCard adds 'text-red-500' class when liked
    expect(likeButton).toHaveClass('text-red-500');

    console.log('User simulation successful: Post created and liked successfully.');
  });
});
