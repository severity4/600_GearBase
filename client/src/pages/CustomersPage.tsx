import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { Search, Plus, Phone, Mail } from 'lucide-react'

interface Customer {
  id: string
  name: string
  phone: string
  email: string
  isBlacklisted: boolean
  totalRentals: number
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get('/customers', { params: search ? { search } : undefined })
      return res.data
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜尋客戶..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          新增客戶
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">載入中...</div>
      ) : !customers?.length ? (
        <div className="py-12 text-center text-muted-foreground">沒有找到客戶</div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <Card key={c.id} className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    {c.isBlacklisted && <Badge variant="destructive">黑名單</Badge>}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {c.totalRentals} 筆租賃
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
