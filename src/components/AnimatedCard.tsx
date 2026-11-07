import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  index?: number;
  className?: string;
  onClick?: () => void;
}

export default function AnimatedCard({ children, index = 0, className = '', onClick }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <Card className={`glass-card-hover ${className}`}>
        <CardContent className="p-4">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}
