import { neon } from '@neondatabase/serverless';

let initialized=false;

function getSql(){
  const url=process.env.DATABASE_URL;
  if(!url) return null;
  return neon(url);
}

async function ensureSchema(sql){
  if(initialized)return;
  await sql`
    CREATE TABLE IF NOT EXISTS astro_observations (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      event_key TEXT NOT NULL,
      event_time TIMESTAMPTZ,
      day DATE,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(type,event_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS astro_observations_type_day_idx ON astro_observations(type, day DESC)`;
  initialized=true;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin','*');
  const sql=getSql();
  if(!sql)return res.status(503).json({error:'Database not configured',needs:'DATABASE_URL'});

  try{
    await ensureSchema(sql);

    if(req.method==='POST'){
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
      const type=cleanType(body?.type);
      const eventKey=String(body?.eventKey||body?.event_key||'').trim().slice(0,500);
      const payload=body?.payload;
      const eventTime=validIso(body?.eventTime||body?.event_time);
      const day=validDay(body?.day,eventTime);

      if(!type||!eventKey||!payload||typeof payload!=='object'){
        return res.status(400).json({error:'type, eventKey and object payload are required'});
      }

      const rows=await sql`
        INSERT INTO astro_observations(type,event_key,event_time,day,payload)
        VALUES(${type},${eventKey},${eventTime},${day},${JSON.stringify(payload)}::jsonb)
        ON CONFLICT(type,event_key) DO UPDATE SET
          event_time=EXCLUDED.event_time,
          day=EXCLUDED.day,
          payload=EXCLUDED.payload,
          updated_at=NOW()
        RETURNING id,type,event_key,event_time,day,created_at,updated_at
      `;
      return res.status(200).json({ok:true,observation:rows[0]});
    }

    if(req.method==='GET'){
      const type=cleanType(req.query?.type);
      const days=clampInt(req.query?.days,1,730,30);
      const limit=clampInt(req.query?.limit,1,5000,1000);
      let rows;
      if(type){
        rows=await sql`
          SELECT type,event_key,event_time,day,payload,created_at,updated_at
          FROM astro_observations
          WHERE type=${type} AND COALESCE(day,created_at::date)>=CURRENT_DATE-${days}::int
          ORDER BY COALESCE(event_time,created_at) DESC
          LIMIT ${limit}
        `;
      }else{
        rows=await sql`
          SELECT type,event_key,event_time,day,payload,created_at,updated_at
          FROM astro_observations
          WHERE COALESCE(day,created_at::date)>=CURRENT_DATE-${days}::int
          ORDER BY COALESCE(event_time,created_at) DESC
          LIMIT ${limit}
        `;
      }
      return res.status(200).json({ok:true,count:rows.length,observations:rows});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(error){
    console.error('observations api',error);
    return res.status(500).json({error:'Observation database operation failed',detail:error?.message||String(error)});
  }
}

function cleanType(value){
  const v=String(value||'').trim();
  return ['leader_meeting','aviation_incident','world_focus'].includes(v)?v:'';
}
function validIso(value){
  if(!value)return null;
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toISOString():null;
}
function validDay(value,eventTime){
  const s=String(value||'').slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  return eventTime?eventTime.slice(0,10):new Date().toISOString().slice(0,10);
}
function clampInt(value,min,max,fallback){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback;
}
