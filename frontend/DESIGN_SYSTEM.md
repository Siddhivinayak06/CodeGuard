# CodeGuard Design System

A comprehensive guide to the visual language and component patterns used throughout the CodeGuard application.

---

## 🎨 Color Palette

### Primary Colors

Our primary palette uses OKLCH for perceptually uniform colors:

| Name          | Light Mode             | Dark Mode              | Usage                        |
| ------------- | ---------------------- | ---------------------- | ---------------------------- |
| Primary       | `oklch(0.55 0.25 260)` | `oklch(0.70 0.20 250)` | Buttons, links, focus states |
| Accent Purple | `oklch(0.60 0.25 290)` | `oklch(0.65 0.22 290)` | Highlights, badges           |
| Accent Pink   | `oklch(0.65 0.22 350)` | —                      | Gradients, emphasis          |

### Gradient Palette

```css
/* Primary gradient - used for buttons, headers */
.bg-gradient-primary {
  @apply bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500;
}

/* Blue gradient - for informational elements */
.bg-gradient-blue {
  @apply bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500;
}

/* Warm gradient - for CTAs and attention */
.bg-gradient-warm {
  @apply bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500;
}
```

### Status Colors

| Status  | Color        | Usage                       |
| ------- | ------------ | --------------------------- |
| Success | `green-500`  | Completed, verified, active |
| Warning | `yellow-500` | Pending, needs attention    |
| Error   | `red-500`    | Failed, deleted, urgent     |
| Info    | `blue-500`   | Informational, neutral      |

---

## 📐 Typography

### Font Stack

- **Primary**: Geist Sans (system fallback)
- **Monospace**: Geist Mono (for code)

### Text Styles

```css
/* Gradient text for emphasis */
.text-gradient {
  @apply bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent;
}

/* Heading hierarchy */
h1 {
  @apply text-3xl font-black tracking-tight;
}
h2 {
  @apply text-2xl font-bold;
}
h3 {
  @apply text-lg font-bold;
}
```

---

## 🃏 Card Components

### Glass Card

Basic glassmorphism card for content containers:

```css
.glass-card {
  @apply bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-xl;
}
```

### Glass Card Premium

Enhanced card with gradient border:

```css
.glass-card-premium {
  @apply relative bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl shadow-2xl overflow-hidden;
  /* Has gradient border effect via ::before pseudo-element */
}
```

### Usage

```tsx
<div className="glass-card rounded-2xl p-6">
  {/* Content */}
</div>

<div className="glass-card-premium rounded-3xl p-8">
  {/* Premium content */}
</div>
```

---

## ✨ Animations

### Entrance Animations

| Class                  | Effect            | Duration |
| ---------------------- | ----------------- | -------- |
| `animate-fadeIn`       | Opacity 0→1       | 0.5s     |
| `animate-slideUp`      | Slide from bottom | 0.5s     |
| `animate-slideDown`    | Slide from top    | 0.4s     |
| `animate-scaleIn`      | Scale 0.95→1      | 0.3s     |
| `animate-slideInRight` | Slide from right  | 0.4s     |
| `animate-slideInLeft`  | Slide from left   | 0.4s     |

### Continuous Animations

| Class                   | Effect                   | Duration |
| ----------------------- | ------------------------ | -------- |
| `animate-float`         | Gentle vertical movement | 6s       |
| `animate-float-slow`    | Slower float             | 10s      |
| `animate-pulse-glow`    | Pulsing box shadow       | 3s       |
| `animate-gradient-x`    | Moving gradient          | 6s       |
| `animate-gradient-slow` | Slow gradient            | 15s      |

### Micro-animations

| Class                   | Effect           | Use Case        |
| ----------------------- | ---------------- | --------------- |
| `animate-wiggle`        | Slight rotation  | Attention       |
| `animate-bounce-subtle` | Subtle bounce    | Active items    |
| `animate-heartbeat`     | Scale pulse      | Live indicators |
| `animate-shake`         | Horizontal shake | Error feedback  |
| `animate-breathe`       | Opacity + scale  | Loading states  |

### Animation Delays

```css
.animation-delay-100 {
  animation-delay: 100ms;
}
.animation-delay-200 {
  animation-delay: 200ms;
}
.animation-delay-300 {
  animation-delay: 300ms;
}
.animation-delay-400 {
  animation-delay: 400ms;
}
.animation-delay-500 {
  animation-delay: 500ms;
}
```

---

## 🖱️ Hover Effects

### Basic Hovers

```css
/* Lift up with shadow */
.hover-lift:hover {
  transform: translateY(-4px);
  @apply shadow-xl;
}

/* Scale up slightly */
.hover-scale:hover {
  transform: scale(1.02);
}

/* Glow effect */
.hover-glow:hover {
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.3);
}
```

### Color-specific Glows

```css
.hover-glow-purple:hover {
  /* Purple glow */
}
.hover-glow-blue:hover {
  /* Blue glow */
}
.hover-glow-pink:hover {
  /* Pink glow */
}
```

### Interactive Cards

```css
.card-hover-premium:hover {
  transform: translateY(-4px) scale(1.01);
  @apply shadow-2xl;
}
```

### Link Underline

```css
.link-underline::after {
  /* Animated gradient underline on hover */
}
```

---

## 🔘 Button Styles

### Primary Button

```css
.btn-primary {
  @apply bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 
         text-white font-semibold 
         shadow-lg shadow-purple-500/25 
         hover:shadow-xl hover:shadow-purple-500/40 
         transition-all duration-300 
         hover:-translate-y-0.5;
}
```

### Secondary Button

```css
.btn-secondary {
  @apply bg-white/80 dark:bg-gray-800/80 
         backdrop-blur-sm 
         border border-gray-200 dark:border-gray-700 
         text-gray-700 dark:text-gray-300 
         font-medium;
}
```

### Usage with Framer Motion

```tsx
<motion.button
  whileHover={{ scale: 1.02, translateY: -2 }}
  whileTap={{ scale: 0.98 }}
  className="btn-primary"
>
  Click Me
</motion.button>
```

---

## 📝 Form Inputs

### Premium Input

```css
.input-premium {
  @apply w-full px-4 py-3 rounded-xl 
         bg-white/80 dark:bg-gray-800/80 
         backdrop-blur-sm 
         border border-gray-200 dark:border-gray-700 
         focus:ring-2 focus:ring-purple-500/50 
         focus:border-purple-500 
         transition-all duration-300;
}
```

### With Icon

```tsx
<div className="relative">
  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
  <input className="input-premium pl-12" />
</div>
```

---

## 🏷️ Badges

```css
.badge-success {
  /* Green */
}
.badge-warning {
  /* Yellow */
}
.badge-error {
  /* Red */
}
.badge-info {
  /* Blue */
}
.badge-purple {
  /* Purple */
}
```

Usage:

```tsx
<span className="badge-success">Active</span>
<span className="badge-warning">Pending</span>
<span className="badge-error">Overdue</span>
```

---

## 📊 Status Indicators

### Status Dots

```css
.status-dot-success {
  @apply bg-green-500; /* + glow */
}
.status-dot-warning {
  @apply bg-yellow-500;
}
.status-dot-error {
  @apply bg-red-500;
}
.status-dot-info {
  @apply bg-blue-500;
}
```

### Online Indicator Pattern

```tsx
<div className="relative">
  <Avatar />
  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
</div>
```

---

## 📋 Tables

### Interactive Row

```css
.table-row-interactive {
  @apply transition-all duration-200 cursor-pointer;
}

.table-row-interactive:hover {
  @apply bg-purple-50/50 dark:bg-purple-900/10;
}
```

---

## 🎯 Focus States

```css
/* Ring focus */
.focus-ring-premium:focus {
  @apply outline-none ring-2 ring-purple-500/50 ring-offset-2;
}

/* Glow focus */
.focus-glow:focus {
  box-shadow:
    0 0 0 3px rgba(139, 92, 246, 0.3),
    0 0 20px rgba(139, 92, 246, 0.2);
}
```

---

## 📱 Responsive Breakpoints

| Prefix | Width  | Usage            |
| ------ | ------ | ---------------- |
| `sm:`  | 640px  | Mobile landscape |
| `md:`  | 768px  | Tablets          |
| `lg:`  | 1024px | Laptops          |
| `xl:`  | 1280px | Desktops         |
| `2xl:` | 1536px | Large screens    |

### Responsive Padding Pattern

```css
px-4 sm:px-6 lg:px-8 xl:px-12
```

---

## 🌗 Dark Mode

### Smooth Transitions

Theme changes include a smooth 300ms transition:

```css
html,
body {
  transition:
    background-color 0.3s ease,
    color 0.3s ease;
}
```

### Theme-Aware Utility Classes

**Surface Levels (Elevation)**

```css
.surface-1 {
  @apply bg-white dark:bg-gray-900;
} /* Base */
.surface-2 {
  @apply bg-gray-50 dark:bg-gray-800;
} /* Elevated */
.surface-3 {
  @apply bg-gray-100 dark:bg-gray-700;
} /* More elevated */
```

**Elevation System (Shadows)**
Our design system uses a 5-level elevation scale to create depth.

```css
/* Elevation Classes */
.elevation-0 {
  /* None */
}
.elevation-1 {
  /* Low: Subtle details */
}
.elevation-2 {
  /* Base: Default cards */
}
.elevation-3 {
  /* Medium: Hover states */
}
.elevation-4 {
  /* High: Modals */
}
.elevation-5 {
  /* Highest: Popovers */
}

/* Legacy Mappings */
.shadow-theme-sm {
  @apply elevation-1;
}
.shadow-theme {
  @apply elevation-2;
}
.shadow-theme-lg {
  @apply elevation-3;
}
.shadow-theme-xl {
  @apply elevation-4;
}
```

**Theme-Aware Text**

```css
.text-theme-primary {
  @apply text-gray-900 dark:text-white;
}
.text-theme-secondary {
  @apply text-gray-600 dark:text-gray-300;
}
.text-theme-tertiary {
  @apply text-gray-500 dark:text-gray-400;
}
.text-theme-muted {
  @apply text-gray-400 dark:text-gray-500;
}
```

**Theme-Aware Borders**

```css
.border-theme {
  @apply border-gray-200 dark:border-gray-700/80;
}
.border-theme-subtle {
  @apply border-gray-100 dark:border-gray-800;
}
.border-theme-strong {
  @apply border-gray-300 dark:border-gray-600;
}
```

**Glass Effects**

```css
.glass-light {
  /* Optimized for light mode */
}
.glass-dark {
  /* Optimized for dark mode */
}
.glass-adaptive {
  @apply bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl;
}
```

### Enhanced Glass Cards in Dark Mode

```css
/* Dark mode gets deeper shadows and subtle inner glow */
.dark .glass-card {
  box-shadow:
    0 20px 40px -10px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}

.dark .glass-card-premium {
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
}
```

### Accessibility

```css
/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus visible for keyboard navigation */
:focus-visible {
  @apply outline-2 outline-offset-2 outline-ring;
}
```

---

## 🚀 Best Practices

1. **Use semantic colors** - Prefer `text-gray-900 dark:text-white` over hardcoded colors
2. **Layer animations** - Combine `hover-lift` with Framer Motion for rich interactions
3. **Progressive enhancement** - Base styles work without JS, enhanced with motion
4. **Consistent spacing** - Use Tailwind's spacing scale (4, 6, 8, 12)
5. **Glassmorphism sparingly** - Use on key cards, not every element
6. **Accessible contrast** - Maintain 4.5:1 ratio for text

---

## 📦 Framer Motion Patterns

### Container + Item Variants (Staggered)

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 260, damping: 30 },
  },
};

<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>;
```

### Hover Animation

```tsx
<motion.div
  whileHover={{ scale: 1.02, y: -2 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  Content
</motion.div>
```
