import { useState, useEffect, useCallback } from "react";
import * as api from "./api.js";

export function useKbState() {
  const [user, setUser]           = useState({ name: "", email: "", role: "Adviser" });
  const [categories, setCategories] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Load identity
      const me = await api.getMe();
      const users = await api.getUsers();
      const matched = users.find(u => u.email && me.email && u.email.toLowerCase() === me.email.toLowerCase());
      const role = matched?.role || (me.email ? "Adviser" : "Admin"); // fallback to Admin in dev
      const name = matched?.name || me.name || me.email?.split("@")[0] || "Unknown";
      const resolvedUser = { name, email: me.email || "", role };
      setUser(resolvedUser);

      // Load categories
      const cats = await api.listCategories();
      setCategories(cats);

      // Load favourites
      if (name && name !== "Unknown") {
        const favs = await api.getFavourites(name);
        setFavourites(favs);
      }

      // Load stats (for home/admin)
      const s = await api.getStats();
      setStats(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleFavourite = useCallback(async (articleId) => {
    const existing = favourites.find(f => f.article_id === articleId);
    if (existing) {
      await api.removeFavourite(articleId, user.name);
      setFavourites(prev => prev.filter(f => f.article_id !== articleId));
    } else {
      await api.addFavourite(articleId, user.name);
      // Reload favourites to get article data
      const favs = await api.getFavourites(user.name);
      setFavourites(favs);
    }
  }, [favourites, user.name]);

  const refreshCategories = useCallback(async () => {
    const cats = await api.listCategories();
    setCategories(cats);
  }, []);

  const refreshStats = useCallback(async () => {
    const s = await api.getStats();
    setStats(s);
  }, []);

  const isFavourited = useCallback((articleId) => {
    return favourites.some(f => f.article_id === articleId);
  }, [favourites]);

  return {
    user,
    categories,
    favourites,
    stats,
    loading,
    error,
    reload: loadAll,
    toggleFavourite,
    isFavourited,
    refreshCategories,
    refreshStats,
  };
}
