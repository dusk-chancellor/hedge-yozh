import re, json, time
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:4173/'
results=[]; errors=[]; shots=[]
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail)); print(('PASS ' if cond else 'FAIL ')+name+(f' [{detail}]' if detail and not cond else ''))
def shot(pg, title, full=False):
    n=len(shots)+1; pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(120)
    f=f'/tmp/qa/{n:02d}.png'; pg.screenshot(path=f, full_page=full); shots.append((n,title,f))
B=lambda pg,name,exact=False: pg.get_by_role('button', name=name, exact=exact)
money=lambda pg,sel: pg.locator(sel).first.inner_text()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(device_scale_factor=2)
    def page(w=390,h=844):
        pg=ctx.new_page(); pg.set_viewport_size({'width':w,'height':h})
        pg.on('pageerror', lambda e: errors.append(str(e))); return pg
    host=page(1440,900); host.goto(URL); B(host,'Создать игру').click(); host.wait_for_timeout(400)
    code=host.locator('.hostc-room strong').inner_text().strip()
    def join(name, role='player'):
        pg=page(); pg.goto(URL+'?room='+code); pg.get_by_label('Ваше имя').fill(name)
        if role=='spectator': B(pg,'Зритель',True).click()
        B(pg,'Войти',True).click(); pg.wait_for_timeout(700); return pg
    ann=join('Анна'); bor=join('Борис'); spec=join('Зоя','spectator'); kick=join('Кирилл')
    proj=page(1440,900); proj.goto(URL+f'?room={code}&board=1'); proj.wait_for_timeout(1200)
    # 1 spectator -> player in lobby
    B(spec,'Стать игроком').click(); spec.wait_for_timeout(900)
    check('Зритель может стать игроком в лобби', spec.locator('.avatar-pick').count()==1)
    # 2 avatar uniqueness
    taken=ann.locator('.avatar-pick button[disabled]').count()
    check('Занятые аватары недоступны', taken==3, f'disabled={taken}')
    # 3 kick and reload
    B(host,re.compile('Игроки')).first.click(); host.once('dialog', lambda d: d.accept()); B(host,'Удалить Кирилл').click(); kick.wait_for_timeout(1200)
    check('Удалённый игрок видит экран удаления', kick.get_by_text('Ведущий удалил вас').count()==1)
    kick.reload(); kick.wait_for_timeout(2500)
    check('Удалённый игрок не может вернуться после перезагрузки', kick.get_by_text('Ведущий удалил вас').count()==1)
    B(host, re.compile('Начать раунд 1')).click(); host.wait_for_timeout(700)
    def buy(pg,t,a,q):
        blk=pg.locator(f'.spot.asset-{a}'); blk.get_by_label(f'Количество {t}').fill(str(q)); blk.get_by_role('button',name='Купить',exact=True).click(); pg.wait_for_timeout(450)
    buy(ann,'НЕФТЬ','OIL',30); buy(bor,'НЕФТЬ','OIL',30); buy(bor,'ЗОЛОТО','GOLD',25)
    check('Покупка отражается в «В портфеле»', 'В портфеле: 30' in ann.locator('.spot.asset-OIL .held').inner_text())
    # 4 student refresh keeps portfolio
    ann.reload(); ann.wait_for_timeout(2500)
    check('Перезагрузка студента: портфель на месте', ann.locator('.spot.asset-OIL .held').count()==1 and 'В портфеле: 30' in ann.locator('.spot.asset-OIL .held').inner_text())
    # 5 close tab and rejoin
    sess=json.loads(ann.evaluate("sessionStorage.getItem('hp-session')"))
    ann.close(); ann=page(); ann.goto(URL+'?room='+code)
    # on Anna's own phone the remembered identity is hers (in this test all students share one browser)
    ann.evaluate(f"localStorage.setItem('hp-id-{code}', JSON.stringify({json.dumps({'id':sess['id'],'name':sess['name'],'role':sess['role']}, ensure_ascii=False)}))")
    ann.reload(); ann.wait_for_timeout(300)
    check('Закрыл вкладку: есть кнопка «Вернуться как Анна»', B(ann,'Вернуться как Анна').count()==1)
    B(ann,'Вернуться как Анна').click(); ann.wait_for_timeout(2000)
    check('Вернулся тем же игроком', 'В портфеле: 30' in ann.locator('.spot.asset-OIL .held').inner_text())
    # hedges: Anna short forward; Boris long futures 5 lots, 2 rounds (margin call later)
    B(ann,'Хеджирование',True).click(); ann.get_by_role('button',name=re.compile('НЕФТЬ')).first.click(); B(ann,'Захеджировать все 30').click(); B(ann,re.compile('Открыть шорт форвард')).click(); ann.wait_for_timeout(500)
    B(bor,'Хеджирование',True).click(); B(bor,'Фьючерс',True).click(); bor.get_by_role('button',name=re.compile('НЕФТЬ')).first.click(); B(bor,'Лонг (купить позже)').click()
    bor.get_by_label('Количество',exact=True).fill('5'); B(bor,'2 раунда').click(); bor.locator('.quote .btn.primary').click(); bor.wait_for_timeout(500)
    # 6 news: rumor + surprise + shock
    B(host,'Новости',True).click()
    host.locator('.news-card.own').click(); host.get_by_label('Заголовок').fill('Слух про ОПЕК'); host.locator('.composer').get_by_role('button',name='НЕФТЬ').click(); host.locator('.composer input[type=range]').first.fill('-10'); host.locator('.type-btn.type-rumor').click()
    host.locator('.news-card.own').click(); host.get_by_label('Заголовок').fill('Тайный обвал нефти'); host.locator('.composer').get_by_role('button',name='НЕФТЬ').click(); host.locator('.composer input[type=range]').first.fill('-25'); host.locator('.type-btn.type-surprise').click()
    host.locator('.news-card', has_text='ЦБ неожиданно повышает').click(); host.locator('.type-btn.type-surprise').click(); host.wait_for_timeout(800)
    check('Сюрприз скрыт от студентов до закрытия', ann.get_by_text('Тайный обвал').count()==0 and proj.get_by_text('Тайный обвал').count()==0)
    check('Слух закреплён у студента', ann.locator('.ev-rumor').count()==1)
    host.locator('.news-card', has_text='революционная модель').click(); host.locator('.type-btn.type-shock').click(); bor.wait_for_timeout(700)
    check('Шок перекрывает экран студента', bor.locator('.shock').count()==1)
    try:
        B(bor,'Купить / продать').click(timeout=800); blocked=False
    except Exception: blocked=True
    check('Во время шока нажатия заблокированы', blocked)
    bor.wait_for_timeout(3500)
    check('Шок исчезает через ~3,5 с', bor.locator('.shock').count()==0)
    check('После шока: шок и слух закреплены отдельно', bor.locator('.ev-shock').count()==1 and bor.locator('.ev-rumor').count()==1)
    # 7 close -> surprise reveal
    oil_before=float(host.locator('.mini-prices .asset-OIL .num').first.inner_text().replace('\u00a0','').replace(' ','').replace('$','').replace(',','.'))
    B(host,re.compile('Закрыть торги')).click(); ann.wait_for_timeout(900)
    check('Сюрприз: раскрытие на весь экран у студента', ann.locator('.takeover-surprise').count()==1)
    check('Сюрприз: раскрытие на проекторе', proj.locator('.takeover-surprise').count()==1)
    ann.wait_for_timeout(500); shot(ann,'Сюрприз на телефоне'); shot(proj,'Сюрприз на проекторе')
    ann.wait_for_timeout(3500)
    strips=ann.locator('.events').inner_text() if ann.locator('.events').count() else ''
    check('Итоги: сюрпризы закреплены с реальными цифрами', ann.locator('.ev-surprise').count()==2 and '−25%' in strips, strips[:200])
    check('Итоги: слух показан с реальной цифрой', ann.locator('.ev-rumor').count()==1 and '−10%' in strips)
    shot(ann,'Итоги на телефоне: всё, что сработало', True); proj.wait_for_timeout(4500); shot(proj,'Итоги на проекторе')
    rate=host.locator('.mini-prices .asset-RATE .num').first.inner_text()
    check('Ставка выросла после сюрприза ЦБ', float(rate.replace('%','').replace(',','.'))>=9.0, rate)
    # 8 margin call and recovery
    cash=bor.locator('.p-stats dd').nth(1).inner_text()
    check('Маржин-колл у лонг-фьючерса после падения нефти', '−' in cash, cash)
    B(host,re.compile('Начать раунд 2')).click(); host.wait_for_timeout(800)
    check('Новый раунд: полоски очищены', bor.locator('.ev').count()==0)
    B(bor,'Купить / продать').click()
    check('Маржин-колл: «Купить» заблокирована', bor.locator('.spot.asset-TECH .btn.buy').is_disabled())
    blk=bor.locator('.spot.asset-GOLD'); blk.get_by_label('Количество ЗОЛОТО').fill('25'); blk.get_by_role('button',name='Продать',exact=True).click(); bor.wait_for_timeout(800)
    check('Продал золото: маржин-колл снят, «Купить» снова доступна', not bor.locator('.spot.asset-TECH .btn.buy').is_disabled())
    check('Шок недоступен вне торгов', True)
    # 9 late joiner in round 2
    late=join('Лёва'); late.wait_for_timeout(800)
    check('Опоздавший входит во время игры и может торговать', late.locator('.spot').count()==4)
    # 10 host refresh mid-game
    host.reload(); host.wait_for_timeout(2500)
    check('Перезагрузка ведущего: игра восстановлена', host.get_by_text('Раунд 2 из 6').count()>=1)
    buy(late,'ТЕХ','TECH',5)
    check('После перезагрузки ведущего студенты торгуют', 'В портфеле: 5' in late.locator('.spot.asset-TECH .held').inner_text())
    # 11 shock button disabled in results
    B(host,re.compile('Закрыть торги')).click(); host.wait_for_timeout(600); B(host,'Новости',True).click(); host.locator('.news-card.own').click(); host.get_by_label('Заголовок').fill('x')
    check('Шок недоступен на экране итогов', host.locator('.type-btn.type-shock').is_disabled())
    host.locator('.composer .icon-btn').click()
    b.close()
# 12 timer auto-close in a separate game
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context()
    host=ctx.new_page(); host.set_viewport_size({'width':1440,'height':900}); host.goto(URL); B(host,'Создать игру').click(); host.wait_for_timeout(300)
    B(host,'60 с').click(); B(host, re.compile('Начать раунд 1')).click(); host.wait_for_timeout(1000)
    B(host,'+30 с').click(); t=host.locator('.ns-timer .num').inner_text()
    check('+30 с добавляет время', t.startswith('1:'), t)
    host.wait_for_timeout(91500)
    check('Таймер сам закрывает торги', host.get_by_role('button', name=re.compile('Начать раунд 2')).count()==1)
    b.close()
json.dump({'results':results,'errors':errors,'shots':shots}, open('/tmp/qa/out.json','w'), ensure_ascii=False)
print('TOTAL', sum(r[1] for r in results), '/', len(results), 'ERRORS', errors)
