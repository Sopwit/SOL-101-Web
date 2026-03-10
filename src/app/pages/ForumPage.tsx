import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Filter, Heart, ImageIcon, MessageCircle, Plus, X } from 'lucide-react';
import { ForumPost } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { GlassCard } from '../components/GlassCard';
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
import { mockPosts } from '../lib/mockData';
import { api, type WalletAuthHeaders } from '../services/api';

export function ForumPage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { t, language } = useLanguage();
  const [posts, setPosts] = useState<ForumPost[]>(mockPosts);
  const [filter, setFilter] = useState('newest');
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const createWalletAuth = async (action: string): Promise<WalletAuthHeaders | null> => {
    if (!publicKey || !signMessage) {
      toast.error('Wallet imzalama desteklenmiyor');
      return null;
    }

    const walletAddress = publicKey.toBase58();
    const message = JSON.stringify({
      domain: 'SOL101',
      action,
      walletAddress,
      timestamp: Date.now(),
    });
    const messageBytes = new TextEncoder().encode(message);

    try {
      const signatureBytes = await signMessage(messageBytes);
      const binary = Array.from(signatureBytes, (byte) => String.fromCharCode(byte)).join('');
      const signature = btoa(binary);

      return {
        walletAddress,
        message,
        signature,
      };
    } catch {
      toast.error('İmza işlemi iptal edildi veya başarısız oldu');
      return null;
    }
  };

  const loadPosts = async () => {
    try {
      const response = await api.getPosts({ sort: filter });
      if (response.success && response.data && response.data.length > 0) {
        setPosts(response.data);
      } else if (response.success && response.data && response.data.length === 0) {
        // If API returns success but empty array, and we want to keep mock data for demo:
        // setPosts(mockPosts); // or keep as empty if you prefer
        console.log('API returned empty posts, showing mock data for demo');
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [filter]);

  const tags = ['#duan-game', '#item-showcase', '#progress', '#achievement', '#tips', '#trade-request', '#guide', '#question'];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleLike = async (postId: string) => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }

    const walletAuth = await createWalletAuth('forum:like_post');
    if (!walletAuth) return;

    try {
      const response = await api.likePost(postId, publicKey.toBase58(), walletAuth);
      if (response.success && response.data) {
        const liked = response.data.liked;
        
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                ...post,
                isLiked: liked,
                likeCount: liked ? post.likeCount + 1 : Math.max(0, post.likeCount - 1),
              }
              : post
          )
        );

        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost({
            ...selectedPost,
            isLiked: liked,
            likeCount: liked ? selectedPost.likeCount + 1 : Math.max(0, selectedPost.likeCount - 1),
          });
        }
      } else {
        toast.error(response.error || t('common.error'));
      }
    } catch (error) {
      toast.error(t('common.error'));
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

    setIsCreating(true);
    const walletAddress = publicKey.toBase58();
    const walletAuth = await createWalletAuth('forum:create_post');
    
    if (!walletAuth) {
      setIsCreating(false);
      return;
    }

    try {
      const response = await api.createPost(
        walletAddress,
        {
          title: postTitle.trim(),
          content: postContent.trim(),
          tags: selectedTags,
        },
        walletAuth,
      );

      if (response.success && response.data) {
        setPosts((prev) => [response.data as ForumPost, ...prev]);
        toast.success(t('common.success') + '!');
        setPostTitle('');
        setPostContent('');
        setSelectedTags([]);
      } else {
        toast.error(response.error || t('common.error'));
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsCreating(false);
    }
  };

  const handlePostClick = (post: ForumPost) => {
    setSelectedPost(post);
    setDetailDialogOpen(true);
  };

  const filteredPosts = posts
    .filter((post) => {
      // Tag filter
      if (selectedTag !== 'all' && !post.tags.includes(selectedTag)) return false;

      // Search filter
      const matchesSearch = !searchQuery || 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Time filter
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
      if (filter === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (filter === 'popular') {
        return b.likeCount - a.likeCount;
      } else {
        const aScore = a.likeCount / Math.max(1, (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const bScore = b.likeCount / Math.max(1, (Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return bScore - aScore;
      }
    });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">{t('forum.title')}</h1>
          <p className="text-muted-foreground">
            {t('forum.subtitle')}
          </p>
        </div>

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
              <DialogDescription>
                {t('forum.createPostDesc')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('forum.title.label')}</label>
                <Input
                  placeholder={t('forum.title.label') + '...'}
                  maxLength={100}
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground mt-1">{postTitle.length}/100</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('forum.description.label')}</label>
                <Textarea
                  placeholder={t('forum.description.label') + '...'}
                  rows={6}
                  maxLength={1000}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">{postContent.length}/1000</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('forum.image.label')}</label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                  <Input type="file" accept="image/png,image/jpeg" className="hidden" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">{t('forum.tags.label')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} className="gap-1 pr-1">
                      {tag}
                      <button
                        onClick={() => toggleTag(tag)}
                        className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.filter(t => !selectedTags.includes(t)).map((tag) => (
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

              <Button className="w-full" size="lg" onClick={handleCreatePost} disabled={isCreating}>
                {isCreating ? t('common.loading') : t('forum.createPost')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Advanced Filters */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <Input
            placeholder={t('common.search') + '...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('forum.sort.newest')}</SelectItem>
              <SelectItem value="popular">{t('forum.sort.popular')}</SelectItem>
              <SelectItem value="trending">{t('forum.sort.trending')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('forum.filter.allTime')}</SelectItem>
              <SelectItem value="today">{t('forum.filter.today')}</SelectItem>
              <SelectItem value="week">{t('forum.filter.week')}</SelectItem>
              <SelectItem value="month">{t('forum.filter.month')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Badge
            variant={selectedTag === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedTag('all')}
          >
            {t('common.all')}
          </Badge>
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </GlassCard>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
            <GlassCard hover className="overflow-hidden h-full flex flex-col">
              {post.imageUrl && (
                <div className="aspect-video overflow-hidden cursor-pointer" onClick={() => handlePostClick(post)}>
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                  />
                </div>
              )}
              <div className="p-4 flex flex-col flex-1 cursor-pointer" onClick={() => handlePostClick(post)}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
                    {post.username?.[0] || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{post.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: language === 'tr' ? trLocale : enUS })}
                    </div>
                  </div>
                </div>

                <h3 className="font-bold mb-2 line-clamp-2">{post.title}</h3>
                {post.content && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {post.content}
                  </p>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-auto pt-3 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Heart
                      className={`w-5 h-5 ${post.isLiked ? 'fill-primary text-primary' : ''}`}
                    />
                    <span>{post.likeCount}</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span>{post.commentCount}</span>
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {filteredPosts.length === 0 && (
        <GlassCard className="p-12 text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">{t('common.error')}</h3>
          <p className="text-muted-foreground">
            No posts found with the selected filters.
          </p>
        </GlassCard>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPost?.title}</DialogTitle>
            <DialogDescription asChild>
              {selectedPost && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
                    {selectedPost.username?.[0] || 'A'}
                  </div>
                  <span>{selectedPost.username}</span>
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true, locale: language === 'tr' ? trLocale : enUS })}
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {selectedPost?.imageUrl && (
              <div className="aspect-video overflow-hidden rounded-lg">
                <img
                  src={selectedPost.imageUrl}
                  alt={selectedPost.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {selectedPost?.content && (
              <div className="text-base leading-relaxed">
                {selectedPost.content}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {selectedPost?.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-6 pt-4 border-t border-border/40">
              <button
                onClick={() => handleLike(selectedPost?.id || '')}
                className="flex items-center gap-2 text-base text-muted-foreground hover:text-primary transition-colors"
              >
                <Heart
                  className={`w-6 h-6 ${selectedPost?.isLiked ? 'fill-primary text-primary' : ''}`}
                />
                <span>{selectedPost?.likeCount}</span>
              </button>
              <button className="flex items-center gap-2 text-base text-muted-foreground hover:text-primary transition-colors">
                <MessageCircle className="w-6 h-6" />
                <span>{selectedPost?.commentCount}</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}