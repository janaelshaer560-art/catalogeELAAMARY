const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const crypto = require('crypto');
const supabase = require('../db');
const requireAdmin = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});
const cookie = token => `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  const { data: admin } = await supabase.from('admins').select('*').eq('email', email).single();
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
  await supabase.from('admins').update({ last_login: new Date().toISOString() }).eq('id', admin.id);
  const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.setHeader('Set-Cookie', cookie(token));
  res.json({ admin: { id: admin.id, email: admin.email, name: admin.name } });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ message: 'Logged out' });
});

router.get('/session', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('admins').select('id, email, name').eq('id', req.admin.id).single();
  if (error || !data) return res.status(401).json({ error: 'Session expired' });
  res.json({ admin: data });
});

router.get('/categories', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('categories').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/categories/:categoryId/images', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('item_images')
    .select('*, item:items!inner(category_id, name)')
    .eq('item.category_id', req.params.categoryId)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/categories/:categoryId/images', requireAdmin, upload.array('images', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Select at least one image' });
  const { data: category, error: categoryError } = await supabase.from('categories').select('*').eq('id', req.params.categoryId).single();
  if (categoryError || !category) return res.status(404).json({ error: 'Category not found' });

  let { data: item } = await supabase.from('items').select('id').eq('category_id', category.id).limit(1).maybeSingle();
  if (!item) {
    const result = await supabase.from('items').insert({ category_id: category.id, name: category.name_ar }).select('id').single();
    if (result.error) return res.status(400).json({ error: result.error.message });
    item = result.data;
  }

  const rows = [];
  for (const [index, file] of req.files.entries()) {
    const storagePath = `${category.key}/${crypto.randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { error: uploadError } = await supabase.storage.from('catalog-images').upload(storagePath, file.buffer, { contentType: file.mimetype });
    if (uploadError) return res.status(400).json({ error: uploadError.message });
    const { data: url } = supabase.storage.from('catalog-images').getPublicUrl(storagePath);
    rows.push({ item_id: item.id, storage_path: storagePath, public_url: url.publicUrl, alt_text: category.name_ar, sort_order: index });
  }
  const { data, error } = await supabase.from('item_images').insert(rows).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/items', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('items').select('*, category:categories(*), images:item_images(*)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/items', requireAdmin, async (req, res) => {
  const { category_id, name, description, price, is_published = true } = req.body;
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required' });
  const { data, error } = await supabase.from('items').insert({ category_id, name, description: description || '', price: price || null, is_published }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/items/:id', requireAdmin, async (req, res) => {
  const allowed = ['category_id', 'name', 'description', 'price', 'is_published'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('items').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/items/:id', requireAdmin, async (req, res) => {
  const { data: images } = await supabase.from('item_images').select('storage_path').eq('item_id', req.params.id);
  if (images?.length) await supabase.storage.from('catalog-images').remove(images.map(image => image.storage_path));
  const { error } = await supabase.from('items').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Item deleted' });
});

router.post('/items/:id/images', requireAdmin, upload.array('images', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Select at least one image' });
  const rows = [];
  for (const [index, file] of req.files.entries()) {
    const path = `${req.params.id}/${crypto.randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const { error: uploadError } = await supabase.storage.from('catalog-images').upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (uploadError) return res.status(400).json({ error: uploadError.message });
    const { data: url } = supabase.storage.from('catalog-images').getPublicUrl(path);
    rows.push({ item_id: req.params.id, storage_path: path, public_url: url.publicUrl, alt_text: file.originalname, sort_order: index });
  }
  const { data, error } = await supabase.from('item_images').insert(rows).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.delete('/images/:id', requireAdmin, async (req, res) => {
  const { data: image, error: findError } = await supabase.from('item_images').select('*').eq('id', req.params.id).single();
  if (findError || !image) return res.status(404).json({ error: 'Image not found' });
  await supabase.storage.from('catalog-images').remove([image.storage_path]);
  const { error } = await supabase.from('item_images').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Image deleted' });
});

router.post('/init-admin', async (req, res) => {
  if (!process.env.INIT_ADMIN_SECRET || req.headers['x-init-secret'] !== process.env.INIT_ADMIN_SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const { data: existing } = await supabase.from('admins').select('id').limit(1);
  if (existing?.length) return res.status(409).json({ error: 'Admin already exists' });
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_EMAIL and ADMIN_PASSWORD are required' });
  const password_hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const { data, error } = await supabase.from('admins').insert({ email: process.env.ADMIN_EMAIL, password_hash }).select('id, email, name').single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
