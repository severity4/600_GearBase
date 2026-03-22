import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { Plus, MapPin } from 'lucide-react'

interface Venue {
  id: string
  name: string
  address: string
  capacity: number
  hourlyRate: number
  isActive: boolean
}

export default function VenuesPage() {
  const { data: venues, isLoading } = useQuery<Venue[]>({
    queryKey: ['venues'],
    queryFn: async () => {
      const res = await api.get('/venues')
      return res.data
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {venues?.length ?? 0} 個場地</p>
        <Button>
          <Plus className="h-4 w-4" />
          新增場地
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">載入中...</div>
      ) : !venues?.length ? (
        <div className="py-12 text-center text-muted-foreground">沒有場地資料</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Card key={venue.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {venue.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {venue.address && <p className="text-muted-foreground">{venue.address}</p>}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">容量：{venue.capacity} 人</span>
                  <span className="font-medium">${venue.hourlyRate}/時</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
