const express = require('express');
const supabase = require('../db');
const router = express.Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/categories', async (req, res) => {
  const { data, error } = await supabase.from('categories').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/categories/:categoryId/images', async (req, res) => {
  const { data, error } = await supabase
    .from('item_images')
    .select('id, public_url, alt_text, sort_order, item:items!inner(category_id, name)')
    .eq('item.category_id', req.params.categoryId)
    .eq('item.is_published', true)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(image => ({ ...image, cloudinary_url: image.public_url })));
});

router.get('/items', async (req, res) => {
  const { data, error } = await supabase
    .from('items')
    .select('*, category:categories(*), images:item_images(*)')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/items/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('items')
    .select('*, category:categories(*), images:item_images(*)')
    .eq('id', req.params.id)
    .eq('is_published', true)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Item not found' });
  res.json(data);
});

module.exports = router;
