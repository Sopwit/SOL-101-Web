import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Filter, Heart, ImageIcon, MessageCircle, Plus, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { createWalletAuth } from '../lib/walletAuth';
import { pageDataCache } from '../lib/pageDataCache';
import { GlassCard } from '../components/GlassCard';
import { ContentGridSkeleton } from '../components/ContentGridSkeleton';
import { EmptyStateCard, LoadingStateCard, MaintenanceStateCard } from '../components/ModuleStateCard';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { NotificationRail } from '../components/NotificationRail';
import { PageHero } from '../components/PageHero';
import { PageShell } from '../components/PageShell';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { useAdminAccess } from '../hooks/useAdminAccess';
import { api } from '../services/api';
import type { SystemStatusItem } from '../types';
import type { ForumComment, ForumPost } from '../types';

export function ForumPage() {
  const { isAdmin } = useAdminAccess();
  const { connected, publicKey, signMessage } = useWallet();
  const { t, language } = useLanguage();
  const [posts, setPosts] = useState<ForumPost[]>(() => pageDataCache.forum.posts);
  const [filter, setFilter] = useState('newest');
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(() => pageDataCache.forum.posts.length === 0);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [pendingLikeIds, setPendingLikeIds] = useState<string[]>([]);
  const [statusCheckedAt, setStatusCheckedAt] = useState<string | null>(null);
  const commentsRequestIdRef = useRef(0);

  const loadPosts = async () => {
    if (
      pageDataCache.forum.posts.length === 0 ||
      pageDataCache.forum.filter !== filter ||
      pageDataCache.forum.language !== language
    ) {
      setIsLoading(true);
    }
    try {
      const response = await api.getPosts({ sort: filter, walletAddress: publicKey?.toBase58(), language });
      if (response.success && response.data) {
        setPosts(response.data);
        pageDataCache.forum.posts = response.data;
        setPostsError(null);
      } else {
        setPosts([]);
        pageDataCache.forum.posts = [];
        setPostsError(response.error || 'Forum feed backend tarafindan yuklenemedi.');
      }
      pageDataCache.forum.filter = filter;
      pageDataCache.forum.language = language;
    } finally {
      setIsLoading(false);
      setStatusCheckedAt(new Date().toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    }
  };

  useEffect(() => {
    void loadPosts();
  }, [filter, publicKey, language]);

  const loadComments = async (postId: string) => {
    const requestId = commentsRequestIdRef.current + 1;
    commentsRequestIdRef.current = requestId;

    const cachedComments = pageDataCache.forum.commentsByPost[`${postId}:${language}`];
    if (cachedComments) {
      setComments(cachedComments);
    } else {
      setComments([]);
      setCommentsLoading(true);
    }

    try {
      const response = await api.getComments(postId, language);
      if (commentsRequestIdRef.current !== requestId) {
        return;
      }
      const nextComments = response.success && response.data ? response.data : [];
      setCommentsError(response.success ? null : (response.error || 'Forum yorumlari backend tarafindan yuklenemedi.'));
      setComments(nextComments);
      pageDataCache.forum.commentsByPost[`${postId}:${language}`] = nextComments;
    } finally {
      if (commentsRequestIdRef.current === requestId) {
        setCommentsLoading(false);
        setStatusCheckedAt(new Date().toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }));
      }
    }
  };

  useEffect(() => {
    if (!detailDialogOpen || !selectedPost) {
      commentsRequestIdRef.current += 1;
      setComments([]);
      setCommentContent('');
      setCommentsLoading(false);
      return;
    }

    void loadComments(selectedPost.id);
  }, [detailDialogOpen, selectedPost, language]);

  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    const latestPost = posts.find((post) => post.id === selectedPost.id);
    if (latestPost) {
      setSelectedPost(latestPost);
    }
  }, [posts, selectedPost]);

  const tags = ['#duan-token', '#solana-devnet', '#onchain-shop', '#market-strategy', '#loot-drop', '#build-update', '#guild-call', '#bug-report'];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]));
  };

  const normalizedPostImageUrl = postImageUrl.trim();
  const postImagePreviewVisible = normalizedPostImageUrl.length > 0;
  const postImageUrlValid = !normalizedPostImageUrl || /^https?:\/\/.+/i.test(normalizedPostImageUrl);

  const handleLike = async (postId: string) => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }
    if (pendingLikeIds.includes(postId)) {
      return;
    }

    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'forum:like_post');
    if (!walletAuth) return;

    setPendingLikeIds((prev) => [...prev, postId]);
    try {
      const response = await api.likePost(postId, publicKey.toBase58(), walletAuth);
      if (response.success && response.data) {
        const { liked, likeCount } = response.data;
        setPosts((prev) => {
          const nextPosts = prev.map((post) =>
            post.id === postId
              ? { ...post, isLiked: liked, likeCount }
              : post
          );
          pageDataCache.forum.posts = nextPosts;
          return nextPosts;
        });
        setSelectedPost((prev) => prev && prev.id === postId ? { ...prev, isLiked: liked, likeCount } : prev);
      } else {
        toast.error(response.error || t('common.error'));
      }
    } finally {
      setPendingLikeIds((prev) => prev.filter((id) => id !== postId));
    }
  };

  const handleCreatePost = async () => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error(t('common.error'));
      return;
    }
    if (!postImageUrlValid) {
      toast.error('Medya baglantisi gecerli bir http/https adresi olmali.');
      return;
    }

    setIsCreating(true);
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'forum:create_post');
    if (!walletAuth) {
      setIsCreating(false);
      return;
    }

    const response = await api.createPost(
      publicKey.toBase58(),
      {
        title: postTitle.trim(),
        content: postContent.trim(),
        imageUrl: normalizedPostImageUrl || undefined,
        tags: selectedTags,
      },
      walletAuth
    );

    if (response.success && response.data) {
      setPostTitle('');
      setPostContent('');
      setPostImageUrl('');
      setSelectedTags([]);
      toast.success(t('common.success'));
      await loadPosts();
    } else {
      toast.error(response.error || t('common.error'));
    }

    setIsCreating(false);
  };

  const handleDeletePost = async (postId: string, postWalletAddress: string) => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }

    if (publicKey.toBase58() !== postWalletAddress) {
      toast.error(t('forum.deleteOwnOnly'));
      return;
    }

    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'forum:delete_post');
    if (!walletAuth) return;

    const response = await api.deletePost(postId, publicKey.toBase58(), walletAuth);
    if (response.success) {
      setPosts((prev) => {
        const nextPosts = prev.filter((post) => post.id !== postId);
        pageDataCache.forum.posts = nextPosts;
        return nextPosts;
      });
      Object.keys(pageDataCache.forum.commentsByPost)
        .filter((key) => key.startsWith(`${postId}:`))
        .forEach((key) => {
          delete pageDataCache.forum.commentsByPost[key];
        });
      if (selectedPost?.id === postId) {
        setDetailDialogOpen(false);
        setSelectedPost(null);
      }
      toast.success(t('forum.deleteSuccess'));
    } else {
      toast.error(response.error || t('common.error'));
    }
  };

  const handleCreateComment = async () => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }

    if (!selectedPost || !commentContent.trim()) {
      toast.error(t('common.error'));
      return;
    }

    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'forum:create_comment');
    if (!walletAuth) return;

    setIsSubmittingComment(true);
    try {
      const response = await api.createComment(selectedPost.id, publicKey.toBase58(), { content: commentContent.trim() }, walletAuth);
      if (!response.success || !response.data) {
        toast.error(response.error || t('common.error'));
        return;
      }

      setCommentContent('');
      setPosts((prev) => {
        const nextPosts = prev.map((post) =>
          post.id === selectedPost.id
            ? { ...post, commentCount: post.commentCount + 1 }
            : post
        );
        pageDataCache.forum.posts = nextPosts;
        return nextPosts;
      });
      setSelectedPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      await loadComments(selectedPost.id);
      toast.success(t('forum.commentSuccess'));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const filteredPosts = posts
    .filter((post) => {
      if (selectedTag !== 'all' && !post.tags.includes(selectedTag)) return false;
      const matchesSearch =
        !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (timeFilter !== 'all') {
        const postDate = new Date(post.createdAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
        if (timeFilter === 'today' && hoursDiff > 24) return false;
        if (timeFilter === 'week' && hoursDiff > 24 * 7) return false;
        if (timeFilter === 'month' && hoursDiff > 24 * 30) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filter === 'popular') return b.likeCount - a.likeCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const forumStatuses: SystemStatusItem[] = [
    {
      id: 'forum-backend-feed',
      source: 'backend',
      state: postsError ? 'degraded' : 'healthy',
      severity: postsError ? 'warning' : 'info',
      title: 'Backend Forum Feed',
      detail: postsError || 'Forum post akisi backend uzerinden normal calisiyor.',
      checkedAt: statusCheckedAt || undefined,
    },
    {
      id: 'forum-backend-comments',
      source: 'backend',
      state: commentsError ? 'degraded' : 'healthy',
      severity: commentsError ? 'warning' : 'info',
      title: 'Comment Stream',
      detail: commentsError || 'Post detaylari acildiginda yorum akisi backend uzerinden getiriliyor.',
      checkedAt: statusCheckedAt || undefined,
    },
    {
      id: 'forum-media',
      source: 'assets',
      state: postImagePreviewVisible && !postImageUrlValid ? 'degraded' : 'healthy',
      severity: postImagePreviewVisible && !postImageUrlValid ? 'warning' : 'info',
      title: 'Media Attachments',
      detail: postImagePreviewVisible
        ? postImageUrlValid
          ? 'Yeni post akisinda harici medya baglantisi kullanilmaya hazir.'
          : 'Medya baglantisi gecersiz. Yalnizca http/https URL kullanilmali.'
        : 'Forum postlarinda opsiyonel gorsel baglantisi destekleniyor.',
      checkedAt: statusCheckedAt || undefined,
    },
  ];

  return (
    <>
      <PageShell
        hero={(
          <PageHero
            eyebrow="COMMUNITY FORUM"
            title={t('forum.title')}
            description={t('forum.subtitle')}
            accent="from-orange-400/15 via-amber-300/10 to-yellow-200/20"
            panelTitle="LIVE DISCUSSIONS"
            panelBody="Yorumlar, begeniler ve filtreler tek sosyal akis icinde tutulur. Siralama ve dil tercihiyle aninda yenilenir."
            metrics={[
              { label: 'Posts', value: `${posts.length}` },
              { label: 'Filtered', value: `${filteredPosts.length}` },
              { label: 'Tags', value: `${tags.length}` },
            ]}
            actions={(
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-5 h-5" />
                    {t('forum.newPost')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t('forum.createPost')}</DialogTitle>
                    <DialogDescription>{t('forum.createPostDesc')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('forum.title.label')}</label>
                      <Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} maxLength={100} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('forum.description.label')}</label>
                      <Textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} rows={6} maxLength={1000} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('forum.image.label')}</label>
                      <div className="space-y-4 rounded-[1.5rem] border border-border/50 bg-muted/20 p-5">
                        <Input
                          value={postImageUrl}
                          onChange={(e) => setPostImageUrl(e.target.value)}
                          placeholder="https://..."
                        />
                        <div className="rounded-[1.25rem] border border-dashed border-border/60 bg-background/40 p-6 text-center">
                          {postImagePreviewVisible && postImageUrlValid ? (
                            <div className="space-y-3">
                              <ImageWithFallback src={normalizedPostImageUrl} alt="Forum media preview" className="mx-auto aspect-video w-full max-w-xl rounded-[1.1rem] object-cover" />
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Media Preview</p>
                            </div>
                          ) : (
                            <>
                              <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">{t('forum.imageHint')}</p>
                              {postImagePreviewVisible && !postImageUrlValid ? (
                                <p className="mt-2 text-xs font-medium text-amber-600">Gecerli bir http/https medya baglantisi gir.</p>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('forum.tags.label')}</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedTags.map((tag) => (
                          <Badge key={tag} className="gap-1 pr-1">
                            {tag}
                            <button onClick={() => toggleTag(tag)} className="ml-1 hover:bg-background/20 rounded-full p-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tags.filter((tag) => !selectedTags.includes(tag)).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                            onClick={() => toggleTag(tag)}
                          >
                            + {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleCreatePost} disabled={isCreating}>
                      {isCreating ? t('common.loading') : t('forum.createPost')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          />
        )}
      >

      <GlassCard className="p-5 md:p-6">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_220px]">
        <div className="flex flex-col md:flex-row gap-4">
          <Input placeholder={t('common.search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('forum.sort.newest')}</SelectItem>
              <SelectItem value="popular">{t('forum.sort.popular')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('forum.filter.allTime')}</SelectItem>
              <SelectItem value="today">{t('forum.filter.today')}</SelectItem>
              <SelectItem value="week">{t('forum.filter.week')}</SelectItem>
              <SelectItem value="month">{t('forum.filter.month')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            {tags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
          </SelectContent>
        </Select>
        </div>
      </GlassCard>

      {isLoading ? (
        <>
          <LoadingStateCard
            title="Forum akisi hazirlaniyor"
            description="Postlar, filtreler ve topluluk sinyalleri yukleniyor."
          />
          <ContentGridSkeleton count={4} cardClassName="overflow-hidden p-0" imageClassName="aspect-[16/9]" contentLines={4} />
        </>
      ) : postsError && filteredPosts.length === 0 ? (
        <MaintenanceStateCard
          title="Forum akisi gecici olarak kisitli"
          description={postsError}
          onAction={() => { void loadPosts(); }}
        />
      ) : filteredPosts.length === 0 ? (
        <EmptyStateCard
          title={t('forum.emptyTitle')}
          description={t('forum.emptyDesc')}
          icon={Filter}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredPosts.map((post, index) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className="h-full cursor-pointer p-6" onClick={() => { setSelectedPost(post); setDetailDialogOpen(true); }}>
                {post.imageUrl ? (
                  <div className="mb-5 overflow-hidden rounded-[1.25rem]">
                    <ImageWithFallback src={post.imageUrl} alt={post.title} className="aspect-[16/9] w-full object-cover" />
                  </div>
                ) : null}
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium">{post.username || post.walletAddress}</span>
                  <div className="flex items-center gap-3">
                    {post.isTranslated && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        {t('forum.translated')}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: language === 'tr' ? trLocale : enUS })}
                    </span>
                    {connected && publicKey?.toBase58() === post.walletAddress && (
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeletePost(post.id, post.walletAddress);
                        }}
                        aria-label={t('forum.deletePost')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-bold leading-8">{post.title}</h3>
                <p className="mb-5 line-clamp-4 text-muted-foreground leading-7">{post.content}</p>
                <div className="mb-5 flex flex-wrap gap-2">
                  {post.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary disabled:opacity-60"
                    onClick={(e) => { e.stopPropagation(); void handleLike(post.id); }}
                    disabled={pendingLikeIds.includes(post.id)}
                  >
                    <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current text-primary' : ''}`} />
                    {post.likeCount}
                  </button>
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="w-4 h-4" />
                    {post.commentCount}
                  </span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          {selectedPost && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>{selectedPost.title}</DialogTitle>
                <DialogDescription>{selectedPost.username || selectedPost.walletAddress}</DialogDescription>
              </DialogHeader>
              {selectedPost.imageUrl ? (
                <ImageWithFallback src={selectedPost.imageUrl} alt={selectedPost.title} className="w-full aspect-[16/9] rounded-[1.25rem] object-cover" />
              ) : null}
              {connected && publicKey?.toBase58() === selectedPost.walletAddress && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => void handleDeletePost(selectedPost.id, selectedPost.walletAddress)}
                >
                  <Trash2 className="w-4 h-4" />
                  {t('forum.deletePost')}
                </Button>
              )}
              <p className="text-sm leading-7">{selectedPost.content}</p>
              <div className="flex flex-wrap gap-2">
                {selectedPost.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
              </div>
              <div className="space-y-3 pt-2">
                <h4 className="font-semibold">{t('forum.comments')}</h4>
                {commentsLoading ? (
                  <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                ) : comments.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{comment.username || comment.walletAddress}</span>
                            {comment.isTranslated && (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                {t('forum.translated')}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: language === 'tr' ? trLocale : enUS })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('forum.noComments')}</p>
                )}

                <div className="space-y-3">
                  <Textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    rows={3}
                    placeholder={t('forum.commentPlaceholder')}
                  />
                  <Button className="w-full" onClick={() => void handleCreateComment()} disabled={isSubmittingComment}>
                    {isSubmittingComment ? t('common.loading') : t('forum.sendComment')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </PageShell>
      {isAdmin ? (
        <NotificationRail
          title="Forum Durum Merkezi"
          description="Burada forum akisi icin post ve yorum servislerinin durumunu gorebilirsin."
          triggerLabel="Forum Status"
          items={forumStatuses}
        />
      ) : null}
    </>
  );
}
