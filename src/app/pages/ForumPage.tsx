import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Filter, Heart, ImageIcon, MessageCircle, Plus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr as trLocale, enUS } from 'date-fns/locale';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';
import { createWalletAuth } from '../lib/walletAuth';
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
import { api } from '../services/api';
import type { ForumPost } from '../types';

export function ForumPage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { t, language } = useLanguage();
  const [posts, setPosts] = useState<ForumPost[]>([]);
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
  const [isLoading, setIsLoading] = useState(true);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const response = await api.getPosts({ sort: filter });
      if (response.success && response.data) {
        setPosts(response.data);
      } else {
        setPosts([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [filter]);

  const tags = ['#duan-game', '#item-showcase', '#progress', '#achievement', '#tips', '#trade-request', '#guide', '#question'];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]));
  };

  const handleLike = async (postId: string) => {
    if (!connected || !publicKey) {
      toast.error(t('error.walletRequired'));
      return;
    }

    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'forum:like_post');
    if (!walletAuth) return;

    const response = await api.likePost(postId, publicKey.toBase58(), walletAuth);
    if (response.success && response.data) {
      const liked = response.data.liked;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, isLiked: liked, likeCount: liked ? post.likeCount + 1 : Math.max(0, post.likeCount - 1) }
            : post
        )
      );
    } else {
      toast.error(response.error || t('common.error'));
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
    const walletAuth = await createWalletAuth({ publicKey, signMessage }, 'forum:create_post');
    if (!walletAuth) {
      setIsCreating(false);
      return;
    }

    const response = await api.createPost(
      publicKey.toBase58(),
      { title: postTitle.trim(), content: postContent.trim(), tags: selectedTags },
      walletAuth
    );

    if (response.success && response.data) {
      setPosts((prev) => [response.data as ForumPost, ...prev]);
      setPostTitle('');
      setPostContent('');
      setSelectedTags([]);
      toast.success(t('common.success'));
    } else {
      toast.error(response.error || t('common.error'));
    }

    setIsCreating(false);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">{t('forum.title')}</h1>
          <p className="text-muted-foreground">{t('forum.subtitle')}</p>
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
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Mock gorsel yok. Yukleme entegrasyonu backend ile baglanacak.</p>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6 mb-8">
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

      {isLoading ? (
        <GlassCard className="p-12 text-center">{t('common.loading')}</GlassCard>
      ) : filteredPosts.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Filter className="w-14 h-14 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-bold mb-2">Forumda henuz icerik yok</h3>
          <p className="text-muted-foreground">Mock postlar kaldirildi. Yeni icerikler backend uzerinden gorunecek.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPosts.map((post, index) => (
            <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <GlassCard hover className="p-5 h-full cursor-pointer" onClick={() => { setSelectedPost(post); setDetailDialogOpen(true); }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">{post.username || post.walletAddress}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: language === 'tr' ? trLocale : enUS })}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{post.title}</h3>
                <p className="text-muted-foreground line-clamp-4 mb-4">{post.content}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {post.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                </div>
                <div className="flex items-center gap-4">
                  <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); void handleLike(post.id); }}>
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
              <p className="text-sm leading-7">{selectedPost.content}</p>
              <div className="flex flex-wrap gap-2">
                {selectedPost.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
